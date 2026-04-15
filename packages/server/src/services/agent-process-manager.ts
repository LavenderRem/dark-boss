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

// Agent 进程状态
export type ProcessStatus = 'idle' | 'running' | 'stopping' | 'stopped' | 'error';

// Agent 运行期上下文
interface AgentSession {
  agentId: string;
  status: ProcessStatus;
  sessionId: string | null; // Claude Code 会话 ID，首次调用后获得
  startedAt: number;
  lastOutputAt: number;
  tokenCount: number;
  outputBuffer: string[];
  currentProcess: ChildProcess | null;
  /** 防止并发消息 */
  messageQueue: string[];
  isProcessing: boolean;
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
  appendOutput(agentId, `[用户输入] ${message}`);
  broadcast('agent:process_output', { agentId, text: `[用户输入] ${message}`, channel: 'stdin' });

  // 尝试处理队列
  processQueue(agentId);
}

/**
 * 处理消息队列
 */
async function processQueue(agentId: string): Promise<void> {
  const session = activeSessions.get(agentId);
  if (!session || session.isProcessing || session.messageQueue.length === 0) return;

  session.isProcessing = true;
  const message = session.messageQueue.shift()!;

  try {
    await executeMessage(agentId, message);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '执行失败';
    console.error(`[Agent 进程] 消息执行失败: ${errMsg}`);
    appendOutput(agentId, `[错误] ${errMsg}`);
    broadcast('agent:process_output', { agentId, text: `[错误] ${errMsg}`, channel: 'stderr' });
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
        stdio: ['ignore', 'pipe', 'pipe'],  // stdin=ignore，消息通过 -p 参数传递
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
        // 非零退出码可能是错误，但如果还有消息要处理，继续
        const wasStopping = session.status === 'stopping';
        if (!wasStopping) {
          console.warn(`[Agent 进程] ${agent.name} 进程退出 code=${code}`);
        }
      }

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

      appendOutput(agentId, `[错误] ${err.message}`);
      broadcast('agent:process_output', { agentId, text: `进程错误: ${err.message}`, channel: 'stderr' });
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
 * 处理 stream-json 输出
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

    switch (event.type) {
      case 'assistant':
      case 'text': {
        const text = event.content || event.text || '';
        if (text) {
          appendOutput(agentId, text);
          broadcast('agent:process_output', { agentId, text, channel: 'stdout' });
        }
        break;
      }
      case 'tool_use': {
        const toolName = event.name || event.tool_name || 'unknown';
        const toolInput = event.input ? JSON.stringify(event.input, null, 2) : '';
        appendOutput(agentId, `[工具调用] ${toolName}`);
        broadcast('agent:process_output', {
          agentId,
          text: `[工具调用] ${toolName}`,
          channel: 'tool',
          toolName,
          toolInput,
        });
        break;
      }
      case 'tool_result': {
        const output = event.output || event.content || '';
        const truncated = typeof output === 'string' && output.length > 500
          ? output.slice(0, 500) + '...'
          : String(output);
        appendOutput(agentId, `[工具结果] ${truncated}`);
        broadcast('agent:process_output', {
          agentId,
          text: `[工具结果] ${truncated}`,
          channel: 'tool_result',
        });
        break;
      }
      case 'result': {
        // 最终结果，可能包含 session_id
        const text = event.result || event.content || '';
        if (text) {
          appendOutput(agentId, text);
          broadcast('agent:process_output', { agentId, text, channel: 'stdout' });
        }
        // 捕获 session_id（可能在 result 事件中）
        if (event.session_id && !session.sessionId) {
          session.sessionId = event.session_id;
        }
        // 捕获 token 使用量
        if (event.usage) {
          const tokens = event.usage.total_tokens || 0;
          session.tokenCount += tokens;
          broadcast('agent:token_usage', {
            agentId,
            tokens: session.tokenCount,
            inputTokens: event.usage.input_tokens || 0,
            outputTokens: event.usage.output_tokens || 0,
          });
        }
        break;
      }
      case 'usage': {
        const tokens = event.total_tokens || event.tokens || 0;
        session.tokenCount += tokens;
        if (session.sessionId) {
          run(
            'UPDATE agent_sessions SET token_count = ?, updated_at = ? WHERE session_id = ?',
            [session.tokenCount, Date.now(), session.sessionId]
          );
        }
        broadcast('agent:token_usage', {
          agentId,
          tokens: session.tokenCount,
          inputTokens: event.input_tokens || 0,
          outputTokens: event.output_tokens || 0,
        });
        break;
      }
      case 'error': {
        const errorMsg = event.error || event.message || '未知错误';
        appendOutput(agentId, `[错误] ${errorMsg}`);
        broadcast('agent:process_output', { agentId, text: `[错误] ${errorMsg}`, channel: 'stderr' });
        break;
      }
      default: {
        // 未识别的事件类型，作为原始输出
        const text = typeof event === 'object' ? JSON.stringify(event) : String(event);
        if (text.length < 1000) {
          appendOutput(agentId, text);
        }
      }
    }
  } catch {
    // 非 JSON 行，作为纯文本输出
    appendOutput(agentId, line);
    broadcast('agent:process_output', { agentId, text: line, channel: 'stdout' });
  }
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
