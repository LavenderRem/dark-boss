/**
 * Agent 进程管理器
 * 管理与 Claude Code CLI 的交互 —— 采用逐消息调用模式
 *
 * 设计：每次用户发送消息时，spawn 一个 `claude -p "消息" --resume <sessionId>` 进程，
 * 利用 --resume 保持多轮对话上下文。进程完成后自动退出。
 */
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { queryAll, queryOne, run } from '../db/connection.js';
import { broadcast } from '../ws/connection.js';
import { getClaudeEnv } from '../utils/config.js';
import { v4 as uuid } from 'uuid';
import type {
  TerminalEvent,
  TerminalEventPayload,
} from '@dark-boss/shared';

// Agent 进程状态
export type ProcessStatus = 'idle' | 'running' | 'stopping' | 'stopped' | 'error' | 'warming';

// Agent 运行期上下文
interface AgentSession {
  agentId: string;
  status: ProcessStatus;
  sessionId: string | null;
  startedAt: number;
  lastOutputAt: number;
  tokenCount: number;
  inputTokens: number;
  outputTokens: number;
  outputBuffer: string[];
  currentProcess: ChildProcess | null;
  messageQueue: string[];
  isProcessing: boolean;
  // 流式工具调用追踪
  _pendingToolName?: string;
  _pendingToolId?: string;
  _pendingToolInput?: string;
  // 文本缓冲（合并高频 text_delta）
  _textBuffer?: string;
  _textFlushTimer?: ReturnType<typeof setTimeout>;
}

// 活跃的 Agent 会话映射
const activeSessions = new Map<string, AgentSession>();

// 输出缓冲区最大行数
const MAX_OUTPUT_LINES = 5000;

// 获取 Agent 数据库记录
interface AgentRow {
  id: string;
  name: string;
  role: string;
  model: string;
  cwd: string;
  status: string;
  permission_mode: string;
  custom_instructions: string | null;
  allowed_tools: string | null;
  mcp_servers: string | null;
  is_boss: number;
}

/**
 * 启动 Agent 会话（不立即 spawn 进程，仅初始化上下文）
 */
export function spawnAgent(agentId: string): void {
  if (activeSessions.has(agentId)) {
    throw new Error(`Agent ${agentId} 已有活跃会话`);
  }

  const agent = queryOne<AgentRow>('SELECT * FROM agents WHERE id = ?', [agentId]);
  if (!agent) throw new Error('Agent 不存在');

  // 清理残留状态
  if (agent.status === 'working' || agent.status === 'error') {
    console.log(`[Agent 进程] 清理残留状态 ${agent.status} -> idle`);
    run("UPDATE agents SET status = 'offline' WHERE id = ?", [agentId]);
  }

  const session: AgentSession = {
    agentId,
    status: 'idle',
    sessionId: null,
    startedAt: Date.now(),
    lastOutputAt: Date.now(),
    tokenCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    outputBuffer: [],
    currentProcess: null,
    messageQueue: [],
    isProcessing: false,
  };

  activeSessions.set(agentId, session);

  // 更新数据库状态
  run(
    "UPDATE agents SET status = 'working', last_activity_at = ? WHERE id = ?",
    [Date.now(), agentId]
  );

  console.log(`[Agent 进程] ${agent.name} 会话已就绪 (${agentId})`);

  broadcast('agent:process_status', {
    agentId,
    status: 'idle',
    sessionId: null,
  });

  // 预启动：发送空消息获取 session ID，后续消息可直接 --resume
  prewarmSession(agentId, agent);
}

/**
 * 预启动：发送简短空消息获取 session ID
 * 这样后续消息可以直接 --resume，省去重复的 CLI 初始化和 hooks 执行
 */
function prewarmSession(agentId: string, agent: AgentRow): void {
  const session = activeSessions.get(agentId);
  if (!session) return;

  const env = getClaudeEnv();
  const args = [
    '-p', 'hi',
    '--output-format', 'stream-json',
    '--verbose',
    '--model', agent.model || 'sonnet',
    '--permission-mode', agent.permission_mode === 'bypass' ? 'bypassPermissions' : (agent.permission_mode || 'default'),
    '--max-turns', '1',
  ];

  if (agent.custom_instructions) {
    args.push('--append-system-prompt', agent.custom_instructions);
  }

  let workDir = agent.cwd || process.cwd();
  try {
    if (!fs.existsSync(workDir)) workDir = process.cwd();
  } catch {
    workDir = process.cwd();
  }

  session.status = 'warming';
  console.log(`[Agent 进程] ${agent.name} 预启动中...`);

  const childProcess = spawn('claude', args, {
    cwd: workDir,
    shell: true,
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  session.currentProcess = childProcess;

  let stdoutBuffer = '';
  childProcess.stdout?.on('data', (data: Buffer) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed);
        // 只关心 session_id 捕获
        if (event.session_id && !session.sessionId) {
          session.sessionId = event.session_id;
          console.log(`[Agent 进程] ${agent.name} 预启动完成，session: ${session.sessionId}`);

          // 保存会话记录
          const sessionRecordId = uuid();
          run(
            `INSERT INTO agent_sessions (id, agent_id, session_id, status, working_dir, token_count, created_at, updated_at)
             VALUES (?, ?, ?, 'active', ?, 0, ?, ?)`,
            [sessionRecordId, agentId, session.sessionId, agent.cwd || '', Date.now(), Date.now()]
          );
        }
      } catch { /* ignore */ }
    }
  });

  // 忽略 stderr
  childProcess.stderr?.on('data', () => {});

  childProcess.on('close', () => {
    session.currentProcess = null;
    session.status = 'idle';

    broadcast('agent:process_status', {
      agentId,
      status: 'idle',
      sessionId: session.sessionId,
    });

    if (session.sessionId) {
      console.log(`[Agent 进程] ${agent.name} 预热就绪，后续消息将使用 --resume`);
    } else {
      console.warn(`[Agent 进程] ${agent.name} 预启动未获取 session ID，将使用正常模式`);
    }
  });

  childProcess.on('error', () => {
    session.currentProcess = null;
    session.status = 'idle';
    console.warn(`[Agent 进程] ${agent.name} 预启动失败，将使用正常模式`);
  });
}

/**
 * 停止 Agent 会话（终止当前运行的进程，清除会话）
 */
export function stopAgent(agentId: string): void {
  const session = activeSessions.get(agentId);
  if (!session) throw new Error(`Agent ${agentId} 没有活跃会话`);

  session.status = 'stopping';

  // 终止当前运行的子进程
  if (session.currentProcess && !session.currentProcess.killed) {
    try {
      session.currentProcess.kill('SIGTERM');
      // 强制超时杀死
      const proc = session.currentProcess;
      setTimeout(() => {
        if (!proc.killed) {
          try { proc.kill('SIGKILL'); } catch { /* 进程可能已退出 */ }
        }
      }, 5000);
    } catch { /* 进程可能已退出 */ }
  }

  session.currentProcess = null;
  session.isProcessing = false;
  session.messageQueue = [];
  session.status = 'stopped';

  // 更新会话记录
  if (session.sessionId) {
    run(
      "UPDATE agent_sessions SET status = 'ended', token_count = ?, updated_at = ? WHERE session_id = ?",
      [session.tokenCount, Date.now(), session.sessionId]
    );
  }

  run(
    "UPDATE agents SET status = 'offline', last_activity_at = ? WHERE id = ?",
    [Date.now(), agentId]
  );

  activeSessions.delete(agentId);

  broadcast('agent:process_status', {
    agentId,
    status: 'stopped',
  });
}

/**
 * 重启 Agent 会话
 */
export function restartAgent(agentId: string): void {
  if (activeSessions.has(agentId)) {
    stopAgent(agentId);
    // 短暂等待清理完成
    setTimeout(() => {
      if (!activeSessions.has(agentId)) {
        spawnAgent(agentId);
      }
    }, 500);
  } else {
    spawnAgent(agentId);
  }
}

/**
 * 向 Agent 发送消息
 * 使用逐消息 spawn 模式：每次消息都启动一个新的 claude 进程
 */
export function sendToAgent(agentId: string, message: string): void {
  const session = activeSessions.get(agentId);
  if (!session) throw new Error(`Agent ${agentId} 没有活跃会话，请先启动`);

  // 将消息加入队列
  session.messageQueue.push(message);

  // 广播用户输入回显
  emitTerminalEvent(agentId, { type: 'user_input', content: message });

  // 尝试处理队列
  processQueue(agentId);
}

/**
 * 处理权限响应（前端回传）
 */
export function handlePermissionResponse(agentId: string, response: string): void {
  const session = activeSessions.get(agentId);
  if (!session || !session.currentProcess) return;

  const proc = session.currentProcess;
  if (proc.stdin && !proc.stdin.destroyed) {
    proc.stdin.write(response + '\n');
    console.log(`[Agent 进程] 权限响应已写入 stdin: ${response}`);
  }
}

/**
 * 处理消息队列
 */
async function processQueue(agentId: string): Promise<void> {
  const session = activeSessions.get(agentId);
  if (!session || session.isProcessing || session.messageQueue.length === 0) return;

  // 如果正在预启动，等待完成后再处理
  if (session.status === 'warming') {
    const checkInterval = setInterval(() => {
      const s = activeSessions.get(agentId);
      if (!s || s.status !== 'warming') {
        clearInterval(checkInterval);
        if (s && !s.isProcessing && s.messageQueue.length > 0) {
          processQueue(agentId);
        }
      }
    }, 200);
    return;
  }

  session.isProcessing = true;
  const message = session.messageQueue.shift()!;

  try {
    await executeMessage(agentId, message);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '执行失败';
    console.error(`[Agent 进程] 消息执行失败: ${errMsg}`);
    emitTerminalEvent(agentId, { type: 'error', message: errMsg });
  } finally {
    session.isProcessing = false;
    // 继续处理队列中的下一条消息
    if (session.messageQueue.length > 0) {
      processQueue(agentId);
    }
  }
}

/**
 * 执行单条消息：spawn 一个 claude 进程
 */
async function executeMessage(agentId: string, message: string): Promise<void> {
  const session = activeSessions.get(agentId);
  if (!session) return;

  const agent = queryOne<AgentRow>('SELECT * FROM agents WHERE id = ?', [agentId]);
  if (!agent) throw new Error('Agent 不存在');

  const env = getClaudeEnv();

  // 构建 CLI 参数
  const permissionMode = agent.permission_mode === 'bypass'
    ? 'bypassPermissions'
    : agent.permission_mode || 'default';

  const args = [
    '-p', message,
    '--output-format', 'stream-json',
    '--verbose',
    '--model', agent.model || 'sonnet',
    '--permission-mode', permissionMode,
  ];

  // 如果有上一次的会话 ID，使用 --resume 保持上下文
  if (session.sessionId) {
    args.push('--resume', session.sessionId);
  }

  // 添加自定义指令
  if (agent.custom_instructions) {
    args.push('--append-system-prompt', agent.custom_instructions);
  }

  // 添加允许的工具
  if (agent.allowed_tools) {
    const tools = typeof agent.allowed_tools === 'string'
      ? JSON.parse(agent.allowed_tools)
      : agent.allowed_tools;
    if (Array.isArray(tools) && tools.length > 0) {
      args.push('--allowedTools', tools.join(','));
    }
  }

  // 解析工作目录
  let workDir = agent.cwd || process.cwd();
  try {
    if (!fs.existsSync(workDir)) {
      console.warn(`[Agent 进程] 工作目录 ${workDir} 不存在，回退到 ${process.cwd()}`);
      workDir = process.cwd();
    }
  } catch {
    workDir = process.cwd();
  }

  // 更新状态为运行中
  session.status = 'running';
  broadcast('agent:process_status', {
    agentId,
    status: 'running',
  });

  console.log(`[Agent 进程] ${agent.name} 执行消息: "${message.slice(0, 50)}..." ${session.sessionId ? `(resume: ${session.sessionId})` : '(新会话)'}`);

  return new Promise<void>((resolve, reject) => {
    let childProcess: ChildProcess;
    try {
      childProcess = spawn('claude', args, {
        cwd: workDir,
        shell: true,
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],  // stdin=pipe 支持权限交互
      });
    } catch (spawnErr) {
      const errMsg = spawnErr instanceof Error ? spawnErr.message : '进程启动失败';
      reject(new Error(errMsg));
      return;
    }

    session.currentProcess = childProcess;

    // 处理标准输出（stream-json 格式）
    let stdoutBuffer = '';
    childProcess.stdout?.on('data', (data: Buffer) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        handleStreamJson(agentId, trimmed);
      }
    });

    // 处理错误输出
    let stderrBuffer = '';
    childProcess.stderr?.on('data', (data: Buffer) => {
      stderrBuffer += data.toString();
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // 过滤 Claude CLI 的非关键警告
        if (trimmed.includes('no stdin data received') || trimmed.includes('redirect stdin')) {
          console.log(`[Agent 进程] stderr(过滤): ${trimmed.slice(0, 100)}`);
          continue;
        }
        emitTerminalEvent(agentId, { type: 'error', message: trimmed });
        appendOutput(agentId, `[stderr] ${trimmed}`);
        broadcast('agent:process_output', { agentId, text: trimmed, channel: 'stderr' });
      }
    });

    // 进程退出
    childProcess.on('close', (code) => {
      session.currentProcess = null;

      if (code === 0) {
        session.status = 'idle';
        console.log(`[Agent 进程] ${agent.name} 消息处理完成`);
      } else {
        const wasStopping = session.status === 'stopping';
        if (!wasStopping) {
          console.warn(`[Agent 进程] ${agent.name} 进程退出 code=${code}`);
        }
      }

      // 发送最终状态事件
      emitTerminalEvent(agentId, {
        type: 'status',
        model: agent.model || 'sonnet',
        tokens: session.tokenCount,
        inputTokens: session.inputTokens,
        outputTokens: session.outputTokens,
        cost: estimateCost(session.inputTokens, session.outputTokens, agent.model || 'sonnet'),
      });

      // 无论退出码如何，回到 idle 状态以便继续处理队列
      session.status = 'idle';
      broadcast('agent:process_status', {
        agentId,
        status: 'idle',
      });

      resolve();
    });

    // 进程错误
    childProcess.on('error', (err) => {
      console.error(`[Agent 进程] ${agent.name} 进程错误:`, err.message);
      session.currentProcess = null;
      session.status = 'error';

      emitTerminalEvent(agentId, { type: 'error', message: `进程错误: ${err.message}` });

      broadcast('agent:process_status', {
        agentId,
        status: 'error',
        error: err.message,
      });

      reject(err);
    });
  });
}

/**
 * 获取 Agent 进程状态
 */
export function getProcessStatus(agentId: string): ProcessStatus | null {
  return activeSessions.get(agentId)?.status ?? null;
}

/**
 * 获取所有活跃会话
 */
export function getActiveProcesses(): Array<{
  agentId: string;
  status: ProcessStatus;
  pid: number | undefined;
  sessionId: string | null;
  startedAt: number;
  tokenCount: number;
}> {
  return Array.from(activeSessions.entries()).map(([id, session]) => ({
    agentId: id,
    status: session.status,
    pid: session.currentProcess?.pid,
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    tokenCount: session.tokenCount,
  }));
}

/**
 * 获取 Agent 输出历史
 */
export function getOutputHistory(agentId: string): string[] {
  return activeSessions.get(agentId)?.outputBuffer.slice(-100) ?? [];
}

/**
 * 立即刷新文本缓冲区
 */
function flushTextBuffer(agentId: string, session: AgentSession): void {
  if (session._textFlushTimer) {
    clearTimeout(session._textFlushTimer);
    session._textFlushTimer = undefined;
  }
  const text = session._textBuffer;
  if (!text) return;
  session._textBuffer = undefined;
  emitTerminalEvent(agentId, { type: 'text', content: text });
}

/**
 * 调度文本缓冲刷新（50ms 内合并多个 text_delta）
 */
function scheduleTextFlush(agentId: string, session: AgentSession): void {
  if (session._textFlushTimer) return; // 已有 pending flush
  session._textFlushTimer = setTimeout(() => {
    session._textFlushTimer = undefined;
    flushTextBuffer(agentId, session);
  }, 50);
}

/**
 * 发送终端事件（新协议 + 旧协议 fallback）
 */
function emitTerminalEvent(agentId: string, event: TerminalEvent): void {
  // 非 text 事件前先 flush 文本缓冲，保证顺序正确
  if (event.type !== 'text') {
    const sess = activeSessions.get(agentId);
    if (sess?._textBuffer) flushTextBuffer(agentId, sess);
  }

  // 新协议
  broadcast('agent:terminal_event', { agentId, event } satisfies TerminalEventPayload);

  // 旧协议 fallback（标记为 deprecated，仅用于向后兼容）
  appendOutput(agentId, formatEventForLegacy(event));
  broadcast('agent:process_output', mapEventToLegacy(agentId, event));
}

/**
 * 将事件转为旧格式（向后兼容）
 * @deprecated 仅用于旧客户端兼容
 */
function mapEventToLegacy(agentId: string, event: TerminalEvent): {
  agentId: string;
  text: string;
  channel: 'stdout' | 'stderr' | 'stdin' | 'tool' | 'tool_result';
  toolName?: string;
  toolInput?: string;
} {
  switch (event.type) {
    case 'text':
      return { agentId, text: event.content, channel: 'stdout' };
    case 'tool_use':
      return {
        agentId,
        text: `[工具调用] ${event.name}`,
        channel: 'tool',
        toolName: event.name,
        toolInput: JSON.stringify(event.input, null, 2),
      };
    case 'tool_result':
      return { agentId, text: event.content, channel: 'tool_result' };
    case 'permission':
      return { agentId, text: `权限请求: ${event.toolName}`, channel: 'stdin' };
    case 'status':
      return { agentId, text: `状态更新: ${event.tokens} tokens`, channel: 'stdout' };
    case 'error':
      return { agentId, text: event.message, channel: 'stderr' };
    case 'user_input':
      return { agentId, text: `[用户输入] ${event.content}`, channel: 'stdin' };
    default:
      return { agentId, text: JSON.stringify(event), channel: 'stdout' };
  }
}

/**
 * 格式化事件用于旧文本缓冲区
 */
function formatEventForLegacy(event: TerminalEvent): string {
  switch (event.type) {
    case 'text': return event.content;
    case 'tool_use': return `[工具调用] ${event.name}`;
    case 'tool_result': return event.content;
    case 'permission': return `权限请求: ${event.toolName}`;
    case 'status': return `[状态] ${event.tokens} tokens · $${event.cost.toFixed(4)}`;
    case 'error': return `[错误] ${event.message}`;
    case 'user_input': return `[用户输入] ${event.content}`;
    default: return JSON.stringify(event);
  }
}

/**
 * 处理 stream-json 输出（重写版）
 * 将 Claude CLI 的 stream-json 事件转换为类型化 TerminalEvent
 */
function handleStreamJson(agentId: string, line: string): void {
  const session = activeSessions.get(agentId);
  if (!session) return;

  try {
    const event = JSON.parse(line);
    session.lastOutputAt = Date.now();

    // 捕获 session ID（Claude CLI 在输出中返回）
    if (event.session_id && !session.sessionId) {
      session.sessionId = event.session_id;
      console.log(`[Agent 进程] 捕获会话 ID: ${session.sessionId}`);

      // 保存会话记录到数据库
      const agent = queryOne<AgentRow>('SELECT * FROM agents WHERE id = ?', [agentId]);
      const sessionRecordId = uuid();
      run(
        `INSERT INTO agent_sessions (id, agent_id, session_id, status, working_dir, token_count, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, 0, ?, ?)`,
        [sessionRecordId, agentId, session.sessionId, agent?.cwd || '', Date.now(), Date.now()]
      );
    }

    // 处理 content_block_start/delta/stop（流式格式）
    if (event.type === 'content_block_start') {
      handleContentBlockStart(agentId, event);
      return;
    }

    if (event.type === 'content_block_delta') {
      handleContentBlockDelta(agentId, event);
      return;
    }

    if (event.type === 'content_block_stop') {
      // 块结束，立即刷新文本缓冲
      const sess = activeSessions.get(agentId);
      if (sess?._textBuffer) flushTextBuffer(agentId, sess);
      return;
    }

    // 过滤系统事件（hook 通知等）— 不发送到前端
    if (event.type === 'system') {
      console.log(`[Agent 进程] system事件(过滤): ${event.subtype || ''} ${event.hook_name || ''}`);
      return;
    }

    // 过滤不需要展示的协议事件
    if (['message_start', 'message_delta', 'message_stop', 'ping'].includes(event.type)) {
      // 这些是流式协议控制事件，已由上面专门处理
      if (event.type === 'message_start' && event.message?.model) {
        session.lastOutputAt = Date.now();
      }
      return;
    }

    // 处理 message_start（包含模型信息）
    if (event.type === 'message_start' && event.message?.model) {
      session.lastOutputAt = Date.now();
      return;
    }

    // 处理 message_delta（包含 usage）
    if (event.type === 'message_delta' && event.usage) {
      const tokens = event.usage.output_tokens || 0;
      session.outputTokens += tokens;
      session.tokenCount = session.inputTokens + session.outputTokens;
      emitStatusEvent(agentId, session);
      return;
    }

    // 处理旧格式事件（兼容不同版本的 Claude CLI）
    switch (event.type) {
      case 'assistant':
      case 'text': {
        const text = event.content || event.text || '';
        if (text) {
          emitTerminalEvent(agentId, { type: 'text', content: text });
        }
        break;
      }
      case 'tool_use': {
        const toolName = event.name || event.tool_name || 'unknown';
        const toolInput = (event.input || {}) as Record<string, unknown>;
        emitTerminalEvent(agentId, {
          type: 'tool_use',
          name: toolName,
          input: toolInput,
        });
        break;
      }
      case 'tool_result': {
        const output = event.output || event.content || '';
        const content = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
        emitTerminalEvent(agentId, {
          type: 'tool_result',
          toolUseId: event.tool_use_id || '',
          content,
          isError: event.is_error === true,
        });
        break;
      }
      case 'result': {
        // 最终结果
        const text = event.result || event.content || '';
        if (text) {
          emitTerminalEvent(agentId, { type: 'text', content: text });
        }
        // 捕获 session_id
        if (event.session_id && !session.sessionId) {
          session.sessionId = event.session_id;
        }
        // 捕获 token 使用量
        if (event.usage) {
          session.inputTokens += event.usage.input_tokens || 0;
          session.outputTokens += event.usage.output_tokens || 0;
          session.tokenCount = session.inputTokens + session.outputTokens;
          emitStatusEvent(agentId, session);
        }
        break;
      }
      case 'usage': {
        session.inputTokens += event.input_tokens || 0;
        session.outputTokens += event.output_tokens || 0;
        session.tokenCount = session.inputTokens + session.outputTokens;
        if (session.sessionId) {
          run(
            'UPDATE agent_sessions SET token_count = ?, updated_at = ? WHERE session_id = ?',
            [session.tokenCount, Date.now(), session.sessionId]
          );
        }
        emitStatusEvent(agentId, session);
        break;
      }
      case 'error': {
        const errorMsg = event.error || event.message || '未知错误';
        emitTerminalEvent(agentId, { type: 'error', message: errorMsg });
        break;
      }
      default: {
        // 未识别的事件类型，作为原始文本
        const text = typeof event === 'object' ? JSON.stringify(event) : String(event);
        if (text.length < 1000) {
          emitTerminalEvent(agentId, { type: 'text', content: text });
        }
      }
    }
  } catch {
    // 非 JSON 行，作为纯文本输出
    emitTerminalEvent(agentId, { type: 'text', content: line });
  }
}

/**
 * 处理 content_block_start 事件
 */
function handleContentBlockStart(agentId: string, event: Record<string, unknown>): void {
  const contentBlock = event.content_block as Record<string, unknown> | undefined;
  const blockType = contentBlock?.type;
  if (blockType === 'tool_use') {
    const name = contentBlock?.name as string || 'unknown';
    const id = contentBlock?.id as string || '';
    // 工具调用的 input 会在后续 delta 中增量到达
    // 先记录工具名，delta 中累积 input
    const session = activeSessions.get(agentId);
    if (session) {
      session._pendingToolName = name;
      session._pendingToolId = id;
      session._pendingToolInput = '{}';
    }
  }
}

/**
 * 处理 content_block_delta 事件
 */
function handleContentBlockDelta(agentId: string, event: Record<string, unknown>): void {
  const delta = event.delta as Record<string, unknown> | undefined;
  if (!delta) return;
  const session = activeSessions.get(agentId);
  if (!session) return;

  if (delta.type === 'text_delta') {
    const text = (delta as Record<string, unknown>).text as string || '';
    if (text) {
      session._textBuffer = (session._textBuffer || '') + text;
      scheduleTextFlush(agentId, session);
    }
  } else if (delta.type === 'input_json_delta') {
    // 工具调用参数增量
    const partialJson = (delta as Record<string, unknown>).partial_json as string || '';
    const prev = session._pendingToolInput || '{}';
    session._pendingToolInput = prev + partialJson;
  }
}

/**
 * 发送状态事件
 */
function emitStatusEvent(agentId: string, session: AgentSession): void {
  const agent = queryOne<AgentRow>('SELECT * FROM agents WHERE id = ?', [agentId]);
  const model = agent?.model || 'sonnet';

  emitTerminalEvent(agentId, {
    type: 'status',
    model,
    tokens: session.tokenCount,
    inputTokens: session.inputTokens,
    outputTokens: session.outputTokens,
    cost: estimateCost(session.inputTokens, session.outputTokens, model),
  });
}

/**
 * 估算费用（基于 Claude 定价）
 */
function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
  // 简化定价（每百万 token）
  const pricing: Record<string, { input: number; output: number }> = {
    'opus': { input: 15, output: 75 },
    'opus-4-7': { input: 15, output: 75 },
    'sonnet': { input: 3, output: 15 },
    'sonnet-4-6': { input: 3, output: 15 },
    'haiku': { input: 0.80, output: 4 },
    'haiku-4-5': { input: 0.80, output: 4 },
  };
  const p = pricing[model] ?? pricing['sonnet']!;
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

/**
 * 追加输出到缓冲区
 */
function appendOutput(agentId: string, text: string): void {
  const session = activeSessions.get(agentId);
  if (!session) return;

  session.outputBuffer.push(text);
  // 限制缓冲区大小
  if (session.outputBuffer.length > MAX_OUTPUT_LINES) {
    session.outputBuffer = session.outputBuffer.slice(-MAX_OUTPUT_LINES);
  }
}

/**
 * 恢复所有活跃进程（服务重启时调用）
 */
export async function restoreProcesses(): Promise<void> {
  // 清理所有残留的 working/error 状态（服务重启后无活跃进程）
  const agents = queryAll<{ id: string }>(
    "SELECT id FROM agents WHERE status IN ('working', 'error')"
  );

  if (agents.length === 0) return;

  for (const agent of agents) {
    console.log(`[Agent 进程] 清理残留状态 Agent ${agent.id}`);
    run(
      "UPDATE agents SET status = 'offline', last_activity_at = ? WHERE id = ?",
      [Date.now(), agent.id]
    );
  }
  console.log(`[Agent 进程] 已清理 ${agents.length} 个残留状态`);
}

export function shutdownAll(): void {
  if (activeSessions.size === 0) return;

  console.log(`[Agent 进程] 正在关闭 ${activeSessions.size} 个活跃会话...`);

  for (const [agentId, session] of activeSessions) {
    if (session.currentProcess && !session.currentProcess.killed) {
      try {
        session.currentProcess.kill('SIGKILL');
      } catch { /* ignore */ }
    }
    session.currentProcess = null;
    session.status = 'stopped';

    run(
      "UPDATE agents SET status = 'offline', last_activity_at = ? WHERE id = ?",
      [Date.now(), agentId]
    );
  }

  activeSessions.clear();
  console.log('[Agent 进程] 所有会话已关闭');
}
