# Agent 业务状态与终端进程状态同步方案

## 背景

当前 Agent 有两套独立的状态系统：

| 层级 | 状态类型 | 存储 | 定义位置 |
|------|---------|------|---------|
| 业务状态 | `AgentStatus`: `idle \| working \| waiting \| error \| offline` | 数据库 `agents.status` | `shared/types/agent.ts` |
| 进程状态 | `ProcessStatus`: `starting \| ready \| running \| stopping \| stopped \| error \| dead` | 内存 `AgentSession.processState` | `server/services/agent-process-manager.ts` |

两套状态**严重脱节**：

- 新招聘员工 DB 写 `idle`，但 CLI 进程还不存在，用户看到"空闲"误以为已就绪
- 进程异常退出时不更新 DB，残留 `working` 状态导致看起来仍在工作
- 进程闲置超时死亡后 WS 广播 `idle`（误导性），DB 不更新
- 只有 `spawnAgent`（设为 `working`）和 `stopAgent`（设为 `offline`）时同步 DB

## 目标

打通业务状态与终端进程状态，让 Agent 在所有场景下的显示都准确反映真实进程状态。

## 状态映射

| 真实场景 | DB `AgentStatus` | WS `process_status` | 标签 | 颜色 | 当前是否正确 |
|---------|-----------------|-------------------|------|------|:-----------:|
| 新招聘（无进程） | `offline` | — | 离线 | 灰色 | ❌ `idle` |
| 启动 CLI 中 | `working` | `starting` | 工作中 | 绿色 | ✅ |
| 预热完成，就绪待命 | `idle` | `idle` | 空闲 | 绿色 | ❌ 缺 DB 写 |
| 处理消息中 | `working` | `running` | 工作中 | 绿色 | ❌ 缺 DB 写 |
| 消息完成，回到就绪 | `idle` | `idle` | 空闲 | 绿色 | ❌ 缺 DB 写 |
| 主动停止进程 | `offline` | `stopped` | 离线 | 灰色 | ✅ |
| 进程异常退出（无排队） | `offline` | `error` | 离线 | 灰色 | ❌ 缺 DB 写 |
| 进程正常退出 | `offline` | `stopped`（原 `idle`）| 离线 | 灰色 | ❌ WS 错 + 缺 DB |
| 闲置超时杀掉进程 | `offline` | `stopped`（原 `idle`）| 离线 | 灰色 | ❌ WS 错 + 缺 DB |
| 心跳检测假死后重建 | `offline` 再恢复 | `stopped` | 离线→工作 | — | ❌ 缺广播+DB |
| 服务重启清理残留 | `offline` | — | 离线 | 灰色 | ✅（需补充 `idle` 也清理） |

## 后端改动

### 文件：`packages/server/src/routes/agents.ts`

- 创建 Agent 时，初始状态 `'idle'` → `'offline'`

### 文件：`packages/server/src/services/agent-process-manager.ts`

所有 DB 更新格式统一：

```typescript
run("UPDATE agents SET status = ?, last_activity_at = ? WHERE id = ?", [newStatus, Date.now(), agentId])
```

| 位置 | 触发条件 | 当前行为 | 改为 |
|------|---------|---------|------|
| `routeStreamJson` result case | warmup 完成，`isWarmingUp = false` | 无 DB 写 | `DB = idle` |
| `processQueue` | 开始处理消息，`processState = running` | 无 DB 写 | `DB = working` |
| `handleResultMessage` | 消息处理完成，`processState = ready` | 无 DB 写 | `DB = idle` |
| `childProcess.on('close')` code=0 | 进程正常退出（如 max_turns 到达） | WS `idle`，无 DB 写 | WS `stopped`，`DB = offline` |
| `childProcess.on('close')` code≠0, 无排队 | 进程异常退出且无待处理消息 | WS `error`，无 DB 写 | `DB = offline` |
| `childProcess.on('close')` code≠0, 有排队 | 进程异常退出但将自动重建 | 不写 DB（OK）| 不动 |
| `resetIdleTimer` 超时 | 闲置超过 10 分钟杀掉进程 | WS `idle`，无 DB 写 | WS `stopped`，`DB = offline` |
| `handleZombieProcess` | 假死后重建前 | 无广播无 DB 写 | WS `stopped`，`DB = offline` |

### 文件：`packages/server/src/services/agent-process-manager.ts` — 服务重启

`restoreProcesses()` 的条件从 `status IN ('working', 'error')` 改为 `status IN ('working', 'error', 'idle')`，覆盖新增的就绪状态残留。

## 前端改动

### 新增：`packages/client/src/components/agent/agent-status-sync.tsx`

零渲染全局订阅组件：

```typescript
// 映射表
const PROCESS_TO_AGENT_STATUS: Record<string, AgentStatus> = {
  starting: 'working',
  running: 'working',
  idle: 'idle',
  stopped: 'offline',
  error: 'error',
};

function AgentStatusSync() {
  const queryClient = useQueryClient();

  useWsMessage(useCallback((msg) => {
    if (msg.type === 'agent:process_status') {
      const payload = msg.payload as AgentProcessStatusPayload;
      const newStatus = PROCESS_TO_AGENT_STATUS[payload.status];
      if (!newStatus) return;

      queryClient.setQueryData<Agent[]>(['agents'], (old) => {
        if (!old) return old;
        return old.map(a => a.id === payload.agentId ? { ...a, status: newStatus } : a);
      });
    }
  }, [queryClient]));

  return null;
}
```

### 挂载位置

在 `packages/client/src/components/layout/app-layout.tsx` 中插入 `<AgentStatusSync />` 一次，全局生效。

## 边界情况

- **服务重启**：`idle` 状态纳入残留清理，数据库全量修正为 `offline`
- **Chat Agent 路径**：不经过进程管理器，独立 `agent:status` 广播，与本次改动无冲突
- **并发安全**：sql.js 同步单线程，无竞争条件
- **重复更新**：React Query `setQueryData` 对同值不额外触发渲染

## 未涉及范围

- 不新增 `AgentStatus` 类型，复用现有的 `idle/working/waiting/error/offline`
- 不改动数据库 schema
- 不改动聊天路径 (`chat-agent-service.ts`)
