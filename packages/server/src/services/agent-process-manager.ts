/**
 * Agent 进程管理器（流式会话模式）
 *
 * 使用 Claude CLI 的 `--input-format stream-json` 模式，
 * 保持 CLI 进程持久存活，通过 stdin/stdout NDJSON 协议双向通信。
 * 后续消息无需重新启动进程，延迟从 ~12s 降至 <2s。
 */
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { queryAll, queryOne, run } from '../db/connection.js';
import { broadcast } from '../ws/connection.js';
import { getClaudeEnv } from '../utils/config.js';
import { v4 as uuid } from 'uuid';
import type { TerminalEvent, TerminalEventPayload } from '@dark-boss/shared';

// ─── 进程状态 ──────────────────────────────────────────

export type ProcessStatus = 'starting' | 'ready' | 'running' | 'stopping' | 'stopped' | 'error' | 'dead';

// 持久进程的运行期上下文
interface AgentSession {
  agentId: string;
  processState: ProcessStatus;
  sessionId: string | null;
  startedAt: number;
  lastOutputAt: number;
  lastMessageAt: number;
  isWarmingUp: boolean;
  tokenCount: number;
  inputTokens: number;
  outputTokens: number;
  outputBuffer: string[];
  currentProcess: ChildProcess | null;
  messageQueue: string[];
  isProcessing: boolean;
  agentConfig: AgentRow | null;
  // 心跳与闲置监控
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  // 是否已通过 stream_event 发送过文本（用于去重 assistant 中的文本）
  _sentStreamText?: boolean;
  _pendingToolName?: string;
  _pendingToolId?: string;
  _pendingToolInput?: string;
  // 文本缓冲（合并高频 text_delta）
  _textBuffer?: string;
  _textFlushTimer?: ReturnType<typeof setTimeout>;
  // 初始化标记（system/init 只处理一次）
  _gotInit: boolean;
  // 挂起的权限请求
  _pendingPermissionRequestId?: string;
}

// Agent 数据库记录
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

// ─── 常量 ──────────────────────────────────────────────

const activeSessions = new Map<string, AgentSession>();
const MAX_OUTPUT_LINES = 5000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 60_000;
const IDLE_TIMEOUT_MS = 10 * 60_000; // 10 分钟
const PROCESS_STARTUP_TIMEOUT_MS = 60_000;
const GRACEFUL_SHUTDOWN_MS = 5_000;

// ─── 导出的公共 API ────────────────────────────────────

/**
 * 启动 Agent 会话：spawn 一个持久 CLI 进程
 */
export function spawnAgent(agentId: string): void {
  if (activeSessions.has(agentId)) {
    throw new Error(`Agent ${agentId} 已有活跃会话`);
  }

  const agent = queryOne<AgentRow>('SELECT * FROM agents WHERE id = ?', [agentId]);
  if (!agent) throw new Error('Agent 不存在');

  // 清理残留状态
  if (agent.status === 'working' || agent.status === 'error') {
    run("UPDATE agents SET status = 'offline' WHERE id = ?", [agentId]);
  }

  const session = createSession(agentId, agent);
  activeSessions.set(agentId, session);

  run("UPDATE agents SET status = 'working', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);

  console.log(`[Agent 进程] ${agent.name} 启动持久会话...`);
  broadcast('agent:process_status', { agentId, status: 'starting', sessionId: null });

  spawnPersistentProcess(agentId, agent);
}

/**
 * 停止 Agent 会话
 */
export function stopAgent(agentId: string): void {
  const session = activeSessions.get(agentId);
  if (!session) throw new Error(`Agent ${agentId} 没有活跃会话`);

  cleanupSession(session);
  session.processState = 'stopped';

  if (session.sessionId) {
    run(
      "UPDATE agent_sessions SET status = 'ended', token_count = ?, updated_at = ? WHERE session_id = ?",
      [session.tokenCount, Date.now(), session.sessionId]
    );
  }

  run("UPDATE agents SET status = 'offline', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);
  activeSessions.delete(agentId);

  broadcast('agent:process_status', { agentId, status: 'stopped' });
  console.log(`[Agent 进程] ${agentId} 已停止`);
}

/**
 * 重启 Agent 会话
 */
export function restartAgent(agentId: string): void {
  if (activeSessions.has(agentId)) {
    stopAgent(agentId);
    setTimeout(() => {
      if (!activeSessions.has(agentId)) spawnAgent(agentId);
    }, 500);
  } else {
    spawnAgent(agentId);
  }
}

/**
 * 向 Agent 发送消息
 */
export function sendToAgent(agentId: string, message: string): void {
  const session = activeSessions.get(agentId);
  if (!session) throw new Error(`Agent ${agentId} 没有活跃会话，请先启动`);

  session.messageQueue.push(message);
  emitTerminalEvent(agentId, { type: 'user_input', content: message });

  // 进程已死则先重建
  if (session.processState === 'dead' || session.processState === 'error') {
    const agent = session.agentConfig ?? queryOne<AgentRow>('SELECT * FROM agents WHERE id = ?', [agentId]);
    if (agent) {
      console.log(`[Agent 进程] ${agentId} 进程已死，重建后发送消息`);
      spawnPersistentProcess(agentId, agent);
    }
    return;
  }

  processQueue(agentId);
}

/**
 * 处理权限响应（前端回传）
 */
export function handlePermissionResponse(agentId: string, response: string): void {
  const session = activeSessions.get(agentId);
  if (!session?.currentProcess) return;

  // 解析前端发来的响应
  let parsed: { approved: boolean; requestId?: string };
  try {
    parsed = JSON.parse(response);
  } catch {
    parsed = { approved: response === 'yes' || response === 'y', requestId: session._pendingPermissionRequestId };
  }

  const requestId = parsed.requestId || session._pendingPermissionRequestId;
  if (!requestId) return;

  if (parsed.approved) {
    // 批准 — 需要传回原始 input（当前场景下没有原始 input 记录，使用空对象）
    writeStdin(session, {
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: requestId,
        response: { behavior: 'allow', updatedInput: {} },
      },
    });
  } else {
    writeStdin(session, {
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: requestId,
        response: { behavior: 'deny', message: '用户拒绝', interrupt: false },
      },
    });
  }

  session._pendingPermissionRequestId = undefined;
}

/**
 * 获取 Agent 进程状态
 */
export function getProcessStatus(agentId: string): ProcessStatus | null {
  return activeSessions.get(agentId)?.processState ?? null;
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
    status: session.processState,
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
 * 恢复所有活跃进程（服务重启时调用）
 */
export async function restoreProcesses(): Promise<void> {
  const agents = queryAll<{ id: string }>("SELECT id FROM agents WHERE status IN ('working', 'error', 'idle')");
  if (agents.length === 0) return;

  for (const agent of agents) {
    console.log(`[Agent 进程] 清理残留状态 Agent ${agent.id}`);
    run("UPDATE agents SET status = 'offline', last_activity_at = ? WHERE id = ?", [Date.now(), agent.id]);
  }
  console.log(`[Agent 进程] 已清理 ${agents.length} 个残留状态`);
}

/**
 * 关闭所有会话
 */
export function shutdownAll(): void {
  if (activeSessions.size === 0) return;
  console.log(`[Agent 进程] 正在关闭 ${activeSessions.size} 个活跃会话...`);

  for (const [, session] of activeSessions) {
    cleanupSession(session);
    session.processState = 'stopped';
    run("UPDATE agents SET status = 'offline', last_activity_at = ? WHERE id = ?", [Date.now(), session.agentId]);
  }

  activeSessions.clear();
  console.log('[Agent 进程] 所有会话已关闭');
}

// ─── 持久进程核心 ──────────────────────────────────────

/**
 * Spawn 一个持久的 Claude CLI 进程
 */
function spawnPersistentProcess(agentId: string, agent: AgentRow): void {
  const session = activeSessions.get(agentId);
  if (!session) return;

  const env = getClaudeEnv();
  const permissionMode = agent.permission_mode === 'bypass'
    ? 'bypassPermissions'
    : agent.permission_mode || 'default';

  const args = [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--model', agent.model || 'sonnet',
    '--permission-mode', permissionMode,
  ];

  if (agent.custom_instructions) {
    args.push('--append-system-prompt', agent.custom_instructions);
  }

  if (agent.allowed_tools) {
    const tools = typeof agent.allowed_tools === 'string'
      ? JSON.parse(agent.allowed_tools)
      : agent.allowed_tools;
    if (Array.isArray(tools) && tools.length > 0) {
      args.push('--allowedTools', tools.join(','));
    }
  }

  if (session.sessionId) {
    args.push('--resume', session.sessionId);
  }

  let workDir = agent.cwd || process.cwd();
  try {
    if (!fs.existsSync(workDir)) workDir = process.cwd();
  } catch {
    workDir = process.cwd();
  }

  session.processState = 'starting';
  session.agentConfig = agent;
  console.log(`[Agent 进程] ${agent.name} 启动持久进程 ${session.sessionId ? `(resume: ${session.sessionId})` : '(新会话)'}`);

  console.log(`[Agent 进程] 命令: claude ${args.join(' ')}`);

  const childProcess = spawn('claude', args, {
    cwd: workDir,
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  session.currentProcess = childProcess;

  // 启动超时检测
  const startupTimer = setTimeout(() => {
    if (session.processState === 'starting') {
      console.warn(`[Agent 进程] ${agent.name} 启动超时 (${PROCESS_STARTUP_TIMEOUT_MS / 1000}s)`);
      killProcess(childProcess);
      session.processState = 'error';
      broadcast('agent:process_status', { agentId, status: 'error', error: '启动超时' });
    }
  }, PROCESS_STARTUP_TIMEOUT_MS);

  // stdout → NDJSON 解析
  let stdoutBuffer = '';
  childProcess.stdout?.on('data', (data: Buffer) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      routeStreamJson(agentId, trimmed);
    }
  });

  // stderr
  let stderrBuffer = '';
  childProcess.stderr?.on('data', (data: Buffer) => {
    stderrBuffer += data.toString();
    const lines = stderrBuffer.split('\n');
    stderrBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.includes('no stdin data received') || trimmed.includes('redirect stdin')) continue;
      emitTerminalEvent(agentId, { type: 'error', message: trimmed });
    }
  });

  // 进程退出
  childProcess.on('close', (code) => {
    clearTimeout(startupTimer);
    session.currentProcess = null;

    const wasStopping = session.processState === 'stopping';
    if (wasStopping) return; // 主动停止，不重建

    if (code !== 0) {
      console.warn(`[Agent 进程] ${agent.name} 异常退出 code=${code}`);
      session.processState = 'dead';

      // 如果有排队消息，自动重建
      if (session.messageQueue.length > 0 || session.isProcessing) {
        console.log(`[Agent 进程] ${agent.name} 有待处理消息，自动重建...`);
        setTimeout(() => {
          if (activeSessions.has(agentId) && session.processState === 'dead') {
            spawnPersistentProcess(agentId, agent);
          }
        }, 1000);
      } else {
        run("UPDATE agents SET status = 'offline', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);
        broadcast('agent:process_status', { agentId, status: 'error', error: `进程退出 code=${code}` });
      }
    } else {
      // code=0 且非主动停止 — CLI 正常退出（如 --max-turns 达到上限）
      session.processState = 'dead';
      run("UPDATE agents SET status = 'offline', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);
      broadcast('agent:process_status', { agentId, status: 'stopped', sessionId: session.sessionId });
    }
  });

  childProcess.on('error', (err) => {
    clearTimeout(startupTimer);
    session.currentProcess = null;
    session.processState = 'error';
    console.error(`[Agent 进程] ${agent.name} 进程错误:`, err.message);
    emitTerminalEvent(agentId, { type: 'error', message: `进程错误: ${err.message}` });
    broadcast('agent:process_status', { agentId, status: 'error', error: err.message });
  });

  // stream-json 模式需要 stdin 数据才会开始初始化
  // 发送 "hi" 触发 CLI 输出 system/init，响应会被静默消费（isWarmingUp=true）
  writeStdin(session, {
    type: 'user',
    message: { role: 'user', content: 'hi' },
    parent_tool_use_id: null,
    session_id: session.sessionId || '',
  });

  // 启动心跳和闲置监控
  startHeartbeat(agentId);
  resetIdleTimer(agentId);
}

// ─── stdin 写入 ────────────────────────────────────────

/** 向 CLI 进程 stdin 写入一条 NDJSON 消息 */
function writeStdin(session: AgentSession, msg: Record<string, unknown>): void {
  const proc = session.currentProcess;
  if (!proc?.stdin || proc.stdin.destroyed) {
    console.warn(`[Agent 进程] ${session.agentId} stdin 不可用，跳过写入`);
    return;
  }
  proc.stdin.write(JSON.stringify(msg) + '\n');
}

// ─── stdout 事件路由 ───────────────────────────────────

/**
 * 路由 stdout 的 NDJSON 消息到对应处理器
 */
function routeStreamJson(agentId: string, line: string): void {
  const session = activeSessions.get(agentId);
  if (!session) return;

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(line);
  } catch {
    emitTerminalEvent(agentId, { type: 'text', content: line });
    return;
  }

  session.lastOutputAt = Date.now();
  const type = event.type as string;

  switch (type) {
    case 'system':
      handleSystemEvent(agentId, event);
      break;
    case 'stream_event':
      // 预热期间静默消费流式事件
      if (!session.isWarmingUp) handleStreamEvent(agentId, event);
      break;
    case 'assistant':
      // 预热期间静默消费 assistant 消息
      if (!session.isWarmingUp) handleAssistantMessage(agentId, event);
      break;
    case 'result':
      if (session.isWarmingUp) {
        // 预热完成：静默消费 "hi" 的 result，结束预热
        session.isWarmingUp = false;
        session.processState = 'ready';
        session.lastMessageAt = Date.now();
        console.log(`[Agent 进程] ${agentId} 预热完成，进程就绪`);
        broadcast('agent:process_status', { agentId, status: 'idle', sessionId: session.sessionId });
        run("UPDATE agents SET status = 'idle', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);
        if (session.messageQueue.length > 0) processQueue(agentId);
        else resetIdleTimer(agentId);
      } else {
        handleResultMessage(agentId, event);
      }
      break;
    case 'control_request':
      handleControlRequest(agentId, event);
      break;
    case 'user':
      // tool_result 回传（子 agent 场景），忽略
      break;
    case 'rate_limit_event':
      handleRateLimit(agentId, event);
      break;
    case 'keep_alive':
      // 心跳响应，记录即可
      break;
    default:
      // 尝试兼容旧格式
      handleLegacyEvent(agentId, event);
      break;
  }
}

// ─── system/init 事件 ─────────────────────────────────

function handleSystemEvent(agentId: string, event: Record<string, unknown>): void {
  const session = activeSessions.get(agentId);
  if (!session) return;

  const subtype = event.subtype as string;

  if (subtype === 'init') {
    // 只处理第一次 init，后续的 init 事件（如 resume 触发的）全部忽略
    if (session._gotInit) return;
    session._gotInit = true;

    const sid = event.session_id as string | undefined;
    if (sid && !session.sessionId) {
      session.sessionId = sid;
      console.log(`[Agent 进程] 捕获 session_id: ${sid}`);

      const agent = session.agentConfig ?? queryOne<AgentRow>('SELECT * FROM agents WHERE id = ?', [agentId]);
      if (agent) {
        const sessionRecordId = uuid();
        run(
          `INSERT INTO agent_sessions (id, agent_id, session_id, status, working_dir, token_count, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, 0, ?, ?)`,
          [sessionRecordId, agentId, sid, agent.cwd || '', Date.now(), Date.now()]
        );
      }
    }
    // 预热模式下不改变状态，等待 result 完成预热
    // 非预热模式也不会走到这里（_gotInit 在预热时就设为 true 了）
  }
}

// ─── stream_event 事件（流式 delta）────────────────────

function handleStreamEvent(agentId: string, event: Record<string, unknown>): void {
  const inner = event.event as Record<string, unknown> | undefined;
  if (!inner) return;

  const session = activeSessions.get(agentId);
  if (!session) return;

  const innerType = inner.type as string;

  if (innerType === 'content_block_start') {
    const block = inner.content_block as Record<string, unknown> | undefined;
    if (block?.type === 'tool_use') {
      session._pendingToolName = (block.name as string) || 'unknown';
      session._pendingToolId = (block.id as string) || '';
      session._pendingToolInput = '';
    }
    return;
  }

  if (innerType === 'content_block_delta') {
    const delta = inner.delta as Record<string, unknown> | undefined;
    if (!delta) return;

    if (delta.type === 'text_delta') {
      const text = (delta.text as string) || '';
      if (text) {
        session._sentStreamText = true;
        session._textBuffer = (session._textBuffer || '') + text;
        scheduleTextFlush(agentId, session);
      }
    } else if (delta.type === 'input_json_delta') {
      const partial = (delta.partial_json as string) || '';
      session._pendingToolInput = (session._pendingToolInput || '') + partial;
    }
    return;
  }

  if (innerType === 'content_block_stop') {
    // 块结束，刷新文本缓冲
    if (session._textBuffer) flushTextBuffer(agentId, session);

    // 如果是工具调用块结束，发送完整的 tool_use 事件
    if (session._pendingToolName) {
      let toolInput: Record<string, unknown> = {};
      try {
        toolInput = JSON.parse(session._pendingToolInput || '{}');
      } catch { /* ignore */ }

      emitTerminalEvent(agentId, {
        type: 'tool_use',
        name: session._pendingToolName,
        input: toolInput,
      });

      session._pendingToolName = undefined;
      session._pendingToolId = undefined;
      session._pendingToolInput = undefined;
    }
    return;
  }
}

// ─── assistant 事件（完整响应）─────────────────────────

function handleAssistantMessage(agentId: string, event: Record<string, unknown>): void {
  const message = event.message as Record<string, unknown> | undefined;
  if (!message) return;

  const content = message.content as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(content)) return;

  for (const block of content) {
    if (block.type === 'tool_use') {
      const session = activeSessions.get(agentId);
      if (session?._textBuffer) flushTextBuffer(agentId, session);

      emitTerminalEvent(agentId, {
        type: 'tool_use',
        name: (block.name as string) || 'unknown',
        input: (block.input as Record<string, unknown>) || {},
      });
    }
    // text 块绝不从此处发送——仅通过 stream_event delta 或 result 兜底
  }

  // 提取 usage
  const usage = message.usage as Record<string, number> | undefined;
  if (usage) {
    const session = activeSessions.get(agentId);
    if (session) {
      session.outputTokens += usage.output_tokens || 0;
      session.tokenCount = session.inputTokens + session.outputTokens;
    }
  }
}

// ─── result 事件（查询完成）────────────────────────────

function handleResultMessage(agentId: string, event: Record<string, unknown>): void {
  const session = activeSessions.get(agentId);
  if (!session) return;

  // 刷新残留的文本缓冲
  if (session._textBuffer) flushTextBuffer(agentId, session);

  // 兜底：如果没有收到过 stream delta，从 result 发送最终文本
  if (!session._sentStreamText && event.result && typeof event.result === 'string' && event.result.trim()) {
    emitTerminalEvent(agentId, { type: 'text', content: event.result as string });
  }
  session._sentStreamText = undefined;

  // 提取 token usage 和费用
  const usage = event.usage as Record<string, number> | undefined;
  if (usage) {
    session.inputTokens += usage.input_tokens || 0;
    session.outputTokens += usage.output_tokens || 0;
    session.tokenCount = session.inputTokens + session.outputTokens;
  }

  // 提取费用
  const cost = event.total_cost_usd as number | undefined;

  const agent = session.agentConfig ?? queryOne<AgentRow>('SELECT * FROM agents WHERE id = ?', [agentId]);
  const model = agent?.model || 'sonnet';

  emitTerminalEvent(agentId, {
    type: 'status',
    model,
    tokens: session.tokenCount,
    inputTokens: session.inputTokens,
    outputTokens: session.outputTokens,
    cost: cost ?? estimateCost(session.inputTokens, session.outputTokens, model),
  });

  // 更新数据库
  if (session.sessionId) {
    run(
      'UPDATE agent_sessions SET token_count = ?, updated_at = ? WHERE session_id = ?',
      [session.tokenCount, Date.now(), session.sessionId]
    );
  }

  // 切回就绪状态
  session.isProcessing = false;
  session.processState = 'ready';
  session.lastMessageAt = Date.now();
  broadcast('agent:process_status', { agentId, status: 'idle', sessionId: session.sessionId });
  run("UPDATE agents SET status = 'idle', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);

  // 处理队列中的下一条消息
  if (session.messageQueue.length > 0) {
    processQueue(agentId);
  } else {
    // 没有更多消息，重置闲置计时器
    resetIdleTimer(agentId);
  }
}

// ─── control_request 事件（权限请求）──────────────────

function handleControlRequest(agentId: string, event: Record<string, unknown>): void {
  const session = activeSessions.get(agentId);
  if (!session) return;

  const request = event.request as Record<string, unknown> | undefined;
  if (!request) return;

  const subtype = request.subtype as string;

  if (subtype === 'can_use_tool') {
    const requestId = event.request_id as string;
    const toolName = (request.tool_name as string) || 'unknown';
    const toolInput = (request.input as Record<string, unknown>) || {};

    session._pendingPermissionRequestId = requestId;

    emitTerminalEvent(agentId, {
      type: 'permission',
      toolName,
      input: toolInput,
      options: ['allow', 'deny'],
    });

    console.log(`[Agent 进程] ${agentId} 权限请求: ${toolName} (request_id: ${requestId})`);
  }
}

// ─── rate_limit 事件 ──────────────────────────────────

function handleRateLimit(agentId: string, event: Record<string, unknown>): void {
  const info = event.rate_limit_info as Record<string, unknown> | undefined;
  const retryAfter = info?.retry_after_ms as number | undefined;
  emitTerminalEvent(agentId, {
    type: 'error',
    message: `速率限制${retryAfter ? `，${Math.ceil(retryAfter / 1000)}s 后重试` : ''}`,
  });
}

// ─── 旧格式兼容 ───────────────────────────────────────

function handleLegacyEvent(agentId: string, event: Record<string, unknown>): void {
  const session = activeSessions.get(agentId);
  if (!session) return;

  const type = event.type as string;

  // 兼容旧版本 CLI 的事件格式
  switch (type) {
    case 'text':
    case 'assistant': {
      const text = (event.content || event.text || '') as string;
      if (text) emitTerminalEvent(agentId, { type: 'text', content: text });
      break;
    }
    case 'tool_use': {
      emitTerminalEvent(agentId, {
        type: 'tool_use',
        name: (event.name || event.tool_name || 'unknown') as string,
        input: (event.input || {}) as Record<string, unknown>,
      });
      break;
    }
    case 'tool_result': {
      const output = event.output || event.content || '';
      emitTerminalEvent(agentId, {
        type: 'tool_result',
        toolUseId: (event.tool_use_id || '') as string,
        content: typeof output === 'string' ? output : JSON.stringify(output, null, 2),
        isError: event.is_error === true,
      });
      break;
    }
    case 'usage': {
      session.inputTokens += (event.input_tokens as number) || 0;
      session.outputTokens += (event.output_tokens as number) || 0;
      session.tokenCount = session.inputTokens + session.outputTokens;
      break;
    }
    case 'error': {
      emitTerminalEvent(agentId, { type: 'error', message: (event.error || event.message || '未知错误') as string });
      break;
    }
    default: {
      // 消息类型: message_start, message_delta, message_stop, ping 等
      if (type === 'message_start' && event.message) {
        session.lastOutputAt = Date.now();
      }
      if (type === 'message_delta' && event.usage) {
        session.outputTokens += (event.usage as Record<string, number>).output_tokens || 0;
        session.tokenCount = session.inputTokens + session.outputTokens;
      }
      break;
    }
  }
}

// ─── 消息队列与执行 ────────────────────────────────────

function processQueue(agentId: string): void {
  const session = activeSessions.get(agentId);
  if (!session || session.isProcessing || session.messageQueue.length === 0) return;

  // 进程未就绪，等待（starting/running/stopping/stopped/error/dead 状态均不处理）
  if (session.processState !== 'ready') {
    return;
  }

  session.isProcessing = true;
  const message = session.messageQueue.shift()!;

  // 发送用户消息到 stdin
  writeStdin(session, {
    type: 'user',
    message: { role: 'user', content: message },
    parent_tool_use_id: null,
    session_id: session.sessionId || '',
  });

  session.processState = 'running';
  session.lastMessageAt = Date.now();
  broadcast('agent:process_status', { agentId, status: 'running' });
  run("UPDATE agents SET status = 'working', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);

  console.log(`[Agent 进程] ${agentId} 发送消息: "${message.slice(0, 50)}..."`);
}

// ─── 心跳监控 ─────────────────────────────────────────

function startHeartbeat(agentId: string): void {
  const session = activeSessions.get(agentId);
  if (!session) return;

  stopHeartbeat(session);

  session.heartbeatTimer = setInterval(() => {
    if (!session.currentProcess || session.processState === 'dead' || session.processState === 'stopped') {
      stopHeartbeat(session);
      return;
    }

    // 只在 running 状态检测假死：空闲进程等待用户输入不应被杀
    if (session.processState === 'running') {
      if (Date.now() - session.lastOutputAt > HEARTBEAT_TIMEOUT_MS) {
        console.warn(`[Agent 进程] ${agentId} 心跳超时（running 状态无输出），进程可能假死`);
        handleZombieProcess(agentId);
        return;
      }
    }

    // 发送心跳
    writeStdin(session, { type: 'keep_alive' });
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(session: AgentSession): void {
  if (session.heartbeatTimer) {
    clearInterval(session.heartbeatTimer);
    session.heartbeatTimer = null;
  }
}

function handleZombieProcess(agentId: string): void {
  const session = activeSessions.get(agentId);
  if (!session?.currentProcess) return;

  const agent = session.agentConfig ?? queryOne<AgentRow>('SELECT * FROM agents WHERE id = ?', [agentId]);
  console.log(`[Agent 进程] ${agentId} 杀死假死进程，准备重建`);

  killProcess(session.currentProcess);
  session.currentProcess = null;
  session.processState = 'dead';
  run("UPDATE agents SET status = 'offline', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);
  broadcast('agent:process_status', { agentId, status: 'stopped' });

  if (agent) {
    setTimeout(() => {
      if (activeSessions.has(agentId) && session.processState === 'dead') {
        spawnPersistentProcess(agentId, agent);
      }
    }, 2000);
  }
}

// ─── 闲置超时 ─────────────────────────────────────────

function resetIdleTimer(agentId: string): void {
  const session = activeSessions.get(agentId);
  if (!session) return;

  if (session.idleTimer) clearTimeout(session.idleTimer);

  session.idleTimer = setTimeout(() => {
    if (session.isProcessing || session.messageQueue.length > 0) {
      resetIdleTimer(agentId); // 仍在工作，重新计时
      return;
    }

    console.log(`[Agent 进程] ${agentId} 闲置超时，关闭进程释放资源`);
    if (session.currentProcess) {
      killProcess(session.currentProcess);
      session.currentProcess = null;
    }
    session.processState = 'dead';
    stopHeartbeat(session);

    run("UPDATE agents SET status = 'offline', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);
    broadcast('agent:process_status', { agentId, status: 'stopped', sessionId: session.sessionId });
  }, IDLE_TIMEOUT_MS);
}

// ─── 工具函数 ──────────────────────────────────────────

function createSession(agentId: string, agent: AgentRow): AgentSession {
  return {
    agentId,
    processState: 'starting',
    isWarmingUp: true,
    _gotInit: false,
    sessionId: null,
    startedAt: Date.now(),
    lastOutputAt: Date.now(),
    lastMessageAt: Date.now(),
    tokenCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    outputBuffer: [],
    currentProcess: null,
    messageQueue: [],
    isProcessing: false,
    agentConfig: agent,
    heartbeatTimer: null,
    idleTimer: null,
  };
}

function cleanupSession(session: AgentSession): void {
  stopHeartbeat(session);
  if (session.idleTimer) clearTimeout(session.idleTimer);
  session.idleTimer = null;

  if (session.currentProcess && !session.currentProcess.killed) {
    killProcess(session.currentProcess);
  }
  session.currentProcess = null;
  session.messageQueue = [];
  session.isProcessing = false;

  if (session._textFlushTimer) clearTimeout(session._textFlushTimer);
  session._textFlushTimer = undefined;
  session._textBuffer = undefined;
}

function killProcess(proc: ChildProcess): void {
  try {
    proc.kill('SIGTERM');
    const p = proc;
    setTimeout(() => {
      if (!p.killed) {
        try { p.kill('SIGKILL'); } catch { /* 已退出 */ }
      }
    }, GRACEFUL_SHUTDOWN_MS);
  } catch { /* 已退出 */ }
}

// ─── 文本缓冲 ─────────────────────────────────────────

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

function scheduleTextFlush(agentId: string, session: AgentSession): void {
  if (session._textFlushTimer) return;
  session._textFlushTimer = setTimeout(() => {
    session._textFlushTimer = undefined;
    flushTextBuffer(agentId, session);
  }, 50);
}

// ─── 事件广播 ─────────────────────────────────────────

function emitTerminalEvent(agentId: string, event: TerminalEvent): void {
  const sess = activeSessions.get(agentId);
  if (event.type !== 'text' && sess?._textBuffer) {
    flushTextBuffer(agentId, sess);
  }

  // 新协议
  broadcast('agent:terminal_event', { agentId, event } satisfies TerminalEventPayload);

  // 旧协议 fallback
  appendOutput(agentId, formatEventForLegacy(event));
  broadcast('agent:process_output', mapEventToLegacy(agentId, event));
}

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
        agentId, text: `[工具调用] ${event.name}`, channel: 'tool',
        toolName: event.name, toolInput: JSON.stringify(event.input, null, 2),
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

function appendOutput(agentId: string, text: string): void {
  const session = activeSessions.get(agentId);
  if (!session) return;
  session.outputBuffer.push(text);
  if (session.outputBuffer.length > MAX_OUTPUT_LINES) {
    session.outputBuffer = session.outputBuffer.slice(-MAX_OUTPUT_LINES);
  }
}

function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
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
