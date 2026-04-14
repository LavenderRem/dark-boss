/**
 * 聊天 Agent 自动回复服务
 * 处理 @ 提及触发 Agent 回复，通过 WebSocket 流式推送
 */
import { queryAll, queryOne, run } from '../db/connection.js';
import { v4 as uuid } from 'uuid';
import { streamQuery, isSdkAvailable, clearSession, type AgentConfig } from './claude-client.js';
import { broadcast } from '../ws/connection.js';

// 正在处理的 Agent 回复：agentId -> true
const processingAgents = new Set<string>();

// 角色描述映射
const ROLE_DESCRIPTIONS: Record<string, string> = {
  frontend: '前端开发工程师，擅长 React、Vue、TypeScript、CSS',
  backend: '后端开发工程师，擅长 Node.js、Python、API 设计',
  fullstack: '全栈开发工程师，前后端兼顾',
  architect: '架构师，擅长系统设计、代码审查、技术选型',
  tester: '测试工程师，擅长测试用例设计、质量保障',
  devops: '运维工程师，擅长 CI/CD、Docker、Kubernetes',
  dba: '数据库管理员，擅长 SQL 优化、数据库设计',
  pm: '产品经理，擅长需求分析、PRD 编写、项目管理',
  po: '产品负责人，负责产品规划和优先级排序',
  designer: '设计师，擅长 UI/UX 设计、交互设计',
  custom: 'AI 助手',
};

/**
 * 处理 Agent 被提及后的自动回复
 * 异步执行，不阻塞调用方
 */
export async function handleAgentMention(
  channelId: string,
  mentionedAgentIds: string[],
  userMessage: string,
) {
  for (const agentId of mentionedAgentIds) {
    // 跳过正在处理的 Agent
    if (processingAgents.has(agentId)) continue;

    // 异步处理每个 Agent
    processAgentReply(channelId, agentId, userMessage).catch(err => {
      console.error(`[聊天Agent] Agent ${agentId} 回复失败:`, err);
    });
  }
}

async function processAgentReply(
  channelId: string,
  agentId: string,
  userMessage: string,
) {
  console.log(`[聊天Agent] 开始处理 Agent ${agentId} 的回复...`);

  if (!isSdkAvailable()) {
    console.warn('[聊天Agent] SDK 不可用，跳过自动回复');
    processingAgents.delete(agentId);
    return;
  }

  processingAgents.add(agentId);

  // 获取 Agent 信息
  const agent = queryOne<{
    id: string; name: string; role: string; status: string;
    cwd: string; model: string; permission_mode: string;
    custom_instructions: string | null; allowed_tools: string;
    mcp_servers: string | null;
  }>('SELECT * FROM agents WHERE id = ?', [agentId]);

  if (!agent) {
    processingAgents.delete(agentId);
    return;
  }

  // 更新 Agent 状态为 working
  run("UPDATE agents SET status = 'working', current_task = ? WHERE id = ?", [
    `聊天回复: ${userMessage.slice(0, 50)}`,
    agentId,
  ]);
  broadcast('agent:status', {
    agentId,
    status: 'working',
    currentTask: `聊天回复中...`,
  });

  // 解析 Agent 配置
  const agentConfig: AgentConfig = {
    name: agent.name,
    role: agent.role,
    model: (agent.model as 'sonnet' | 'opus' | 'haiku') || 'sonnet',
    cwd: agent.cwd || process.cwd(),
    permissionMode: (agent.permission_mode as 'bypass' | 'acceptEdits' | 'plan') || 'plan',
    customInstructions: agent.custom_instructions,
    allowedTools: agent.allowed_tools ? JSON.parse(agent.allowed_tools) : [],
    mcpServers: agent.mcp_servers ? JSON.parse(agent.mcp_servers) : null,
  };

  // 获取历史消息作为上下文
  const history = queryAll<{
    sender_type: string;
    sender_agent_id: string | null;
    content: string;
  }>(
    `SELECT sender_type, sender_agent_id, content FROM chat_messages
     WHERE channel_id = ? ORDER BY created_at DESC LIMIT 20`,
    [channelId]
  ).reverse();

  // 构建上下文
  const roleDesc = ROLE_DESCRIPTIONS[agent.role] || 'AI 助手';
  const historyText = history
    .map(m => {
      const sender = m.sender_type === 'user' ? '用户' : (m.sender_agent_id ? `Agent` : '系统');
      return `${sender}: ${m.content}`;
    })
    .join('\n');

  const prompt = `你是一个名叫"${agent.name}"的${roleDesc}。

以下是聊天频道中的最近对话：
${historyText}

用户刚才发了一条消息：${userMessage}

请用中文回复，保持专业但友好的语气。回复应简洁有用，与你的角色定位一致。如果合适，可以使用 Markdown 格式来组织你的回复（代码块、列表等）。`;

  try {
    let fullText = '';
    let totalCost = 0;
    let totalTokens = 0;

    // 流式获取回复
    for await (const msg of streamQuery(agentConfig, prompt)) {
      if (msg.type === 'text_delta') {
        fullText += msg.text;
        // 通过 WebSocket 推送增量文本
        broadcast('agent:output', {
          agentId,
          channelId,
          text: msg.text,
        });
      }

      if (msg.type === 'complete') {
        totalCost = msg.result.cost;
        totalTokens = msg.result.tokens;
      }

      if (msg.type === 'error') {
        console.error(`[聊天Agent] SDK 错误: ${msg.error}`);
        broadcast('agent:error', { agentId, error: msg.error });
      }
    }

    // 保存 Agent 回复到数据库
    if (fullText) {
      const msgId = uuid();
      const now = Date.now();
      run(
        `INSERT INTO chat_messages (id, channel_id, sender_type, sender_agent_id, content, mentions_agent_ids, message_type, created_at)
         VALUES (?, ?, 'agent', ?, ?, NULL, 'markdown', ?)`,
        [msgId, channelId, agentId, fullText, now]
      );

      // 广播完整消息
      broadcast('chat:message', {
        channelId,
        messageId: msgId,
        senderType: 'agent',
        senderAgentId: agentId,
        content: fullText,
        messageType: 'markdown',
      });

      // 更新 Agent 的 Token/费用统计
      run(
        'UPDATE agents SET tokens_used = tokens_used + ?, total_cost = total_cost + ? WHERE id = ?',
        [totalTokens, totalCost, agentId]
      );

      // 通知前端流式回复结束
      broadcast('agent:complete', { agentId, channelId });

      console.log(`[聊天Agent] ${agent.name} 回复完成，${totalTokens} tokens，$${totalCost.toFixed(4)}`);
    }
  } catch (err) {
    console.error(`[聊天Agent] ${agent.name} 回复异常:`, err);
    broadcast('agent:error', {
      agentId,
      error: err instanceof Error ? err.message : '回复失败',
    });
  } finally {
    // 恢复 Agent 状态
    processingAgents.delete(agentId);
    run("UPDATE agents SET status = 'idle', current_task = NULL WHERE id = ?", [agentId]);
    broadcast('agent:status', {
      agentId,
      status: 'idle',
      currentTask: null,
    });
  }
}

/**
 * 中断 Agent 的聊天回复
 */
export function interruptAgentReply(agentId: string) {
  clearSession(agentId);
  processingAgents.delete(agentId);

  // 恢复 Agent 状态
  run("UPDATE agents SET status = 'idle', current_task = NULL WHERE id = ?", [agentId]);
  broadcast('agent:status', {
    agentId,
    status: 'idle',
    currentTask: null,
  });
}
