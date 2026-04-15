# Plan: Agent 核心能力升级（对标 Tide Commander）

## Summary

基于 ADR-0005 决策（使用 Claude Agent SDK 替代 CLI 子进程），实现 5 项核心功能：真实 Agent 进程管理 + 内置终端、Boss 委托机制、文件浏览器 + Diff、会话持久化、上下文窗口追踪。

## User Story

作为老板，我希望每个员工是持久运行的 Agent 进程，能实时看到工作过程和文件修改，Boss 自动委托任务，我只需指挥 Boss 就能驱动整个团队。

## Problem -> Solution

- **当前**: Agent 是按需 HTTP API 调用，无持久会话、无实时交互、无文件变更追踪
- **目标**: Agent 是持久进程，有终端、有会话、有文件追踪、Boss 自动委托

## Metadata

- **Complexity**: XL
- **Source PRD**: N/A（Tide Commander 对标分析）
- **Estimated Files**: ~20 新增/修改

---

## 架构决策

使用 Claude Agent SDK（`@anthropic-ai/claude-code`）而非 CLI 子进程（ADR-0005）:
- Windows 原生支持，无需 tmux/node-pty
- 结构化事件流，无需解析 stdout
- 内置会话恢复、权限控制

---

## Step-by-Step Tasks

### Task 1: Agent 进程管理服务（核心）

- **ACTION**: 新建 `AgentProcessManager` 服务，管理 Agent 生命周期
- **IMPLEMENT**: 
  - 创建 `packages/server/src/services/agent-process-manager.ts`
  - 实现 spawn/stop/restart Agent 进程的方法
  - 使用 Claude Code CLI 子进程（`claude` 命令）以 `--output-format stream-json` 模式启动
  - 维护 `Map(agentId -> ChildProcess)` 映射表
  - 解析 stream-json 输出，转发为结构化事件
- **MIRROR**: `packages/server/src/services/claude-client.ts` 的进程管理模式
- **IMPORTS**: `child_process`, `uuid`, `./ws/connection.ts` 的 `broadcast`
- **GOTCHA**: Windows 上 spawn 需要 `shell: true` 选项；需处理进程异常退出
- **VALIDATE**: 能启动/停止 Agent 进程，WebSocket 广播状态变更

### Task 2: WebSocket 事件扩展

- **ACTION**: 扩展 WebSocket 事件类型支持 Agent 进程事件
- **IMPLEMENT**:
  - 在 `packages/server/src/ws/connection.ts` 新增事件处理:
    - `agent:spawn` - 启动 Agent 进程
    - `agent:stop` - 停止 Agent 进程
    - `agent:restart` - 重启 Agent 进程
  - 新增广播事件:
    - `agent:process_output` - Agent 终端输出
    - `agent:process_status` - Agent 状态变更 (idle/working/error/stopped)
    - `agent:file_change` - Agent 修改文件
    - `agent:token_usage` - Token 使用量更新
  - 在 `packages/shared/src/types/event.ts` 新增事件类型定义
- **MIRROR**: 现有 `workflow:execute` / `workflow:progress` 事件模式
- **GOTCHA**: 高频输出事件需做节流（100ms batch），避免 WebSocket 过载
- **VALIDATE**: 前端能接收并显示 Agent 进程事件

### Task 3: 内置终端 UI 组件

- **ACTION**: 创建终端风格组件显示 Agent 实时输出
- **IMPLEMENT**:
  - 创建 `packages/client/src/components/agent/agent-terminal.tsx`
  - 使用 xterm.js 渲染终端输出（支持 ANSI 颜色）
  - 监听 WebSocket `agent:process_output` 事件追加内容
  - 顶部标签栏可切换不同 Agent 的终端
  - 底部输入框可向 Agent 发送消息
  - 集成到员工详情页和员工管理页
- **MIRROR**: `packages/client/src/components/chat/streaming-message.tsx` 的流式渲染模式
- **IMPORTS**: `@xterm/xterm`, `@xterm/addon-fit`
- **GOTCHA**: xterm.js 需要 CSS 引入；终端内容需限制最大行数（5000行）防止内存溢出
- **VALIDATE**: 终端组件能显示 Agent 输出，输入框能发送消息

### Task 4: Boss 委托机制

- **ACTION**: 实现 Boss Agent 自动任务分解和委托
- **IMPLEMENT**:
  - 创建 `packages/server/src/services/boss-delegation.ts`
  - `decomposeTask(taskDescription)` - 调用 Claude API 将任务分解为子任务
  - `assignSubTasks(subTasks, agents)` - 根据角色匹配合适 Agent
  - `monitorProgress(parentTaskId)` - 监控子任务完成状态
  - `synthesizeResults(subTaskResults)` - 汇总子任务结果
  - 在 task-executor.ts 中集成 Boss 角色
  - 前端: 任务创建时可选 "Boss 委托" 模式
  - 看板页面显示任务依赖关系树
- **MIRROR**: `packages/server/src/services/task-executor.ts` 的任务执行模式
- **IMPORTS**: `./claude-client.ts`, `./agent-process-manager.ts`
- **GOTCHA**: Boss 任务分解需要传递团队上下文（可用 Agent 列表和角色）
- **VALIDATE**: 创建 Boss 委托任务后自动分解并指派子任务

### Task 5: 文件浏览器 + Diff 查看器

- **ACTION**: 实现文件系统浏览和变更对比
- **IMPLEMENT**:
  - 后端: 创建 `packages/server/src/routes/files.ts`
    - `GET /files/tree?dir=xxx` - 目录树结构
    - `GET /files/content?path=xxx` - 文件内容
    - `GET /files/changes?agentId=xxx` - Agent 文件变更记录
    - `GET /files/diff?old=xxx&new=xxx` - 文件 Diff
  - 后端: Agent 进程监听文件变更事件，记录到 `agent_file_changes` 表
  - 前端: 创建 `packages/client/src/components/agent/file-explorer.tsx`
    - 左侧文件树（antd Tree 组件）
    - 右侧文件内容/代码查看器（Monaco Editor 只读模式）
    - Diff 视图（双栏对比或 unified diff）
  - 集成到员工详情页的 "文件" 标签页
- **MIRROR**: `packages/server/src/routes/tasks.ts` 的 CRUD 路由模式
- **IMPORTS**: `chokidar`（文件监听）, `diff`（文本对比）, `@monaco-editor/react`
- **GOTCHA**: 文件路径安全校验，防止目录穿越攻击；大文件需截断显示
- **VALIDATE**: 能浏览 Agent 工作目录，查看文件变更历史和 Diff

### Task 6: 会话持久化

- **ACTION**: 实现 Agent 会话的保存和恢复
- **IMPLEMENT**:
  - 新增 `agent_sessions` 数据库表:
    - id, agent_id, session_id, status, working_dir, last_message_id, token_count, created_at, updated_at
  - Agent 进程启动时检查是否有未完成会话，有则恢复
  - 定期保存会话快照到数据库
  - 前端: 员工详情页显示 "会话历史" 列表
  - 支持从历史会话恢复（继续上次对话）
  - 服务重启时自动恢复所有活跃 Agent 的会话
- **MIRROR**: `packages/server/src/db/connection.ts` 的表创建模式
- **IMPORTS**: 数据库操作用 `getDb()` 模式
- **GOTCHA**: 会话恢复需校验工作目录是否存在；过旧会话需清理（7天）
- **VALIDATE**: 服务重启后 Agent 会话自动恢复，前端可查看历史会话

### Task 7: 上下文窗口追踪

- **ACTION**: 追踪和显示 Agent 上下文窗口使用情况
- **IMPLEMENT**:
  - 扩展 `agent_sessions` 表增加 context_tokens 字段
  - Agent 每次交互后更新 token 使用量
  - 新增 API: `GET /agents/:id/context` 返回上下文使用详情
  - 前端: 创建上下文仪表盘组件 `packages/client/src/components/agent/context-meter.tsx`
    - 环形进度条显示上下文使用百分比
    - 颜色编码：绿(0-60%) / 黄(60-80%) / 红(80-100%)
    - tooltip 显示详细 token 数和费用
  - 集成到:
    - 员工详情页头部
    - Header 全局统计栏
    - 绩效页面的 token 统计
- **MIRROR**: `packages/client/src/components/layout/app-layout.tsx` 的 Header 统计模式
- **IMPORTS**: `recharts`（已有）用于图表
- **GOTCHA**: 不同模型的上下文窗口大小不同（Sonnet 200k, Haiku 200k, Opus 200k）
- **VALIDATE**: 实时显示 Agent 上下文使用情况，接近满时发出警告

---

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `packages/server/src/services/agent-process-manager.ts` | CREATE | Agent 进程管理核心服务 |
| `packages/server/src/services/boss-delegation.ts` | CREATE | Boss 委托服务 |
| `packages/server/src/routes/files.ts` | CREATE | 文件浏览器 API |
| `packages/server/src/db/connection.ts` | UPDATE | 新增 agent_sessions + agent_file_changes 表 |
| `packages/server/src/ws/connection.ts` | UPDATE | 新增 Agent 进程事件处理 |
| `packages/server/src/routes/index.ts` | UPDATE | 注册 files 路由 |
| `packages/server/src/routes/agents.ts` | UPDATE | 新增 context 端点 |
| `packages/server/src/services/task-executor.ts` | UPDATE | 集成 Boss 委托 |
| `packages/shared/src/types/event.ts` | UPDATE | 新增事件类型 |
| `packages/client/src/components/agent/agent-terminal.tsx` | CREATE | 终端组件 |
| `packages/client/src/components/agent/file-explorer.tsx` | CREATE | 文件浏览器组件 |
| `packages/client/src/components/agent/context-meter.tsx` | CREATE | 上下文仪表盘 |
| `packages/client/src/pages/agents/index.tsx` | UPDATE | 集成终端和文件浏览器 |
| `packages/client/src/pages/kanban/index.tsx` | UPDATE | Boss 委托 UI |
| `packages/client/src/components/layout/app-layout.tsx` | UPDATE | 上下文统计 |

## NOT Building

- 3D 战场可视化（Tide Commander 的 Three.js 战场，复杂度过高）
- Agent 语音通信
- 多语言 Agent 支持
- Agent 插件市场
- GPU 资源追踪

---

## Patterns to Mirror

### SERVICE_PATTERN
// SOURCE: packages/server/src/services/claude-client.ts
```typescript
// 服务使用 Map 管理状态
const activeSessions = new Map<string, string>();
const activeRequests = new Map<string, ChildProcess>();

// 导出函数式 API
export async function streamQuery(agentId: string, prompt: string, ...): Promise<void> { }
export async function singleQuery(agentId: string, prompt: string, ...): Promise<string> { }
```

### ROUTE_PATTERN
// SOURCE: packages/server/src/routes/workflows.ts
```typescript
const router = Router();

router.get('/', async (req, res) => {
  const db = getDb();
  const rows = db.exec('SELECT ...');
  res.json(transformRows(rows));
});

export default router;
```

### WEBSOCKET_BROADCAST
// SOURCE: packages/server/src/ws/connection.ts
```typescript
export function broadcast<T extends string>(type: T, payload: unknown) {
  const message = { type, payload, timestamp: Date.now() };
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}
```

### DB_TABLE_PATTERN
// SOURCE: packages/server/src/db/connection.ts
```sql
CREATE TABLE IF NOT EXISTS table_name (
  id TEXT PRIMARY KEY,
  ...
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
```

### API_CLIENT_PATTERN
// SOURCE: packages/client/src/api/client.ts
```typescript
// 自动 snake_case -> camelCase 转换
export const api = {
  get: (url) => fetch(...).then(transformKeys),
  post: (url, body) => fetch(...).then(transformKeys),
};
```

---

## Validation Commands

### Type Check
```bash
pnpm --filter @dark-boss/server typecheck
pnpm --filter @dark-boss/client typecheck
```

### Build
```bash
pnpm build
```

### Manual Validation
- [ ] Agent 能启动/停止，终端显示实时输出
- [ ] Boss 任务能自动分解并委托
- [ ] 文件浏览器能浏览工作目录
- [ ] 服务重启后会话自动恢复
- [ ] 上下文使用量实时更新

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Claude Code CLI 不可用 | High | High | 降级到 API 直接调用模式 |
| Windows 进程管理兼容性 | Medium | High | 充分测试 shell: true + cross-spawn |
| WebSocket 高频事件过载 | Medium | Medium | 100ms 节流批量发送 |
| 文件监听性能影响 | Low | Medium | 限制监听目录深度和文件数 |
| 大文件 Diff 渲染卡顿 | Low | Low | 虚拟滚动 + 截断大文件 |

## Notes

- ADR-0005 已决策使用 Claude Agent SDK，但 SDK 当前不可用时回退到 CLI 子进程
- 优先实现 Task 1-3（进程管理+终端+委托），这是核心差异化能力
- Task 4-5（文件浏览+会话持久化）可后续迭代
- Task 6（上下文追踪）是锦上添花，优先级最低
