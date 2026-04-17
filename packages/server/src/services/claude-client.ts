/**
 * Claude API 封装层
 * 直接调用 Anthropic 兼容 API（支持智谱等），无需 CLI
 */
import { resolveModelConfig } from './model-config-service.js';
import type { ResolvedModelConfig } from '@dark-boss/shared';

// 类型定义
interface ApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ApiUsage {
  input_tokens: number;
  output_tokens: number;
}

// Agent 会话存储
const activeSessions = new Map<string, ApiMessage[]>();

// 正在进行的请求
const activeRequests = new Map<string, AbortController>();

// 根据 protocol 构建请求 URL
function getRequestUrl(resolved: ResolvedModelConfig): string {
  if (resolved.protocol === 'openai') {
    return `${resolved.baseUrl}/chat/completions`;
  }
  // anthropic 兼容
  return `${resolved.baseUrl}/v1/messages`;
}

// 根据 protocol 构建请求头
function getRequestHeaders(resolved: ResolvedModelConfig): Record<string, string> {
  if (resolved.protocol === 'openai') {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resolved.apiKey}`,
    };
  }
  // anthropic 兼容
  return {
    'Content-Type': 'application/json',
    'x-api-key': resolved.apiKey,
    'anthropic-version': '2023-06-01',
  };
}

// Agent 配置
export interface AgentConfig {
  name: string;
  role: string;
  model: 'sonnet' | 'opus' | 'haiku';
  cwd: string;
  permissionMode: 'bypass' | 'acceptEdits' | 'plan';
  customInstructions: string | null;
  allowedTools: string[];
  mcpServers?: Record<string, { command: string; args?: string[]; env?: Record<string, string> }> | null;
}

// SDK 调用结果
export interface SdkResult {
  result: string;
  cost: number;
  tokens: number;
  durationMs: number;
}

// 检查 SDK 是否可用
export function isSdkAvailable(): boolean {
  return resolveModelConfig('sonnet') !== null;
}

// 流式调用消息类型
export type SdkStreamMessage =
  | { type: 'text_delta'; text: string }
  | { type: 'complete'; result: SdkResult }
  | { type: 'error'; error: string };


/**
 * 流式调用（用于聊天回复）
 */
export async function* streamQuery(
  agent: AgentConfig,
  prompt: string,
): AsyncGenerator<SdkStreamMessage> {
  const resolved = resolveModelConfig(agent.model);
  if (!resolved) {
    yield { type: 'error', error: '未配置模型提供商，请在模型设置中配置' };
    return;
  }

  abortRequest(agent.name);

  const ctrl = new AbortController();
  activeRequests.set(agent.name, ctrl);

  // 获取或创建会话历史
  let history = activeSessions.get(agent.name);
  if (!history) {
    history = [];
    activeSessions.set(agent.name, history);
  }
  history.push({ role: 'user', content: prompt });

  // 限制历史长度
  if (history.length > 20) {
    history = history.slice(-20);
    activeSessions.set(agent.name, history);
  }

  const systemPrompt = agent.customInstructions || undefined;

  const body: Record<string, unknown> = {
    model: resolved.modelName,
    max_tokens: 4096,
    messages: history,
    stream: true,
  };

  if (systemPrompt) {
    if (resolved.protocol === 'openai') {
      body.messages = [{ role: 'system', content: systemPrompt }, ...history];
    } else {
      body.system = systemPrompt;
    }
  }

  let fullText = '';
  const startTime = Date.now();

  try {
    console.log(`[Claude API] 流式调用 model=${resolved.modelName}, protocol=${resolved.protocol}, 历史消息数=${history.length}`);

    const response = await fetch(getRequestUrl(resolved), {
      method: 'POST',
      headers: getRequestHeaders(resolved),
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 错误 (${response.status}): ${errorText.slice(0, 300)}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage: ApiUsage | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') break;

          try {
            const event = JSON.parse(data);
            // Anthropic format
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
              fullText += event.delta.text;
              yield { type: 'text_delta', text: event.delta.text };
            }
            if (event.type === 'message_delta' && event.usage) usage = event.usage;
            if (event.type === 'message_start' && event.message?.usage) usage = event.message.usage;
            // OpenAI format
            if (event.choices?.[0]?.delta?.content) {
              const text = event.choices[0].delta.content;
              fullText += text;
              yield { type: 'text_delta', text };
            }
            if (event.usage) {
              usage = { input_tokens: event.usage.prompt_tokens || 0, output_tokens: event.usage.completion_tokens || 0 };
            }
          } catch { /* 忽略解析错误 */ }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // 保存助手回复到历史
    if (fullText) history.push({ role: 'assistant', content: fullText });

    const durationMs = Date.now() - startTime;
    const tokens = (usage?.input_tokens || 0) + (usage?.output_tokens || 0);

    console.log(`[Claude API] 回复完成: ${fullText.length} 字符, ${tokens} tokens, ${durationMs}ms`);

    yield {
      type: 'complete',
      result: { result: fullText, cost: 0, tokens, durationMs },
    };
  } catch (err) {
    console.error(`[Claude API] 调用失败:`, err);
    if (!ctrl.signal.aborted) {
      yield { type: 'error', error: err instanceof Error ? err.message : 'API 调用失败' };
    }
  } finally {
    activeRequests.delete(agent.name);
  }
}

/**
 * 单次调用（用于绩效报告等）
 */
export async function singleQuery(
  prompt: string,
  model: 'sonnet' | 'opus' | 'haiku' = 'haiku',
  systemPrompt?: string,
): Promise<SdkResult> {
  const resolved = resolveModelConfig(model);
  if (!resolved) {
    throw new Error('未配置模型提供商，请在模型设置中配置');
  }

  const startTime = Date.now();
  const messages = [{ role: 'user' as const, content: prompt }];

  const body: Record<string, unknown> = { model: resolved.modelName, max_tokens: 4096, messages: [...messages] };
  if (systemPrompt) {
    if (resolved.protocol === 'openai') {
      (body.messages as ApiMessage[]).unshift({ role: 'system', content: systemPrompt });
    } else {
      body.system = systemPrompt;
    }
  }

  console.log(`[Claude API] 单次调用 model=${resolved.modelName}, protocol=${resolved.protocol}`);

  const response = await fetch(getRequestUrl(resolved), {
    method: 'POST',
    headers: getRequestHeaders(resolved),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 错误 (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const result = (await response.json()) as
    | { content: Array<{ type: string; text?: string }>; usage: { input_tokens: number; output_tokens: number } }
    | { choices: Array<{ message: { content: string } }>; usage: { prompt_tokens: number; completion_tokens: number } };

  let text: string;
  let tokens: number;

  if ('choices' in result) {
    text = result.choices.map(c => c.message.content).join('');
    tokens = (result.usage?.prompt_tokens || 0) + (result.usage?.completion_tokens || 0);
  } else {
    text = result.content.filter(b => b.type === 'text').map(b => b.text || '').join('');
    tokens = (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0);
  }

  return {
    result: text,
    cost: 0,
    tokens,
    durationMs: Date.now() - startTime,
  };
}

// 中断正在进行的请求
export function abortRequest(agentName: string) {
  const ctrl = activeRequests.get(agentName);
  if (ctrl) { ctrl.abort(); activeRequests.delete(agentName); }
}

// 清除 Agent 会话
export function clearSession(agentName: string) {
  activeSessions.delete(agentName);
  abortRequest(agentName);
}
