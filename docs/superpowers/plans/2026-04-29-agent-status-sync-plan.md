# Agent 状态同步 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通 Agent 业务状态（DB `agents.status`）与终端进程状态，让所有场景下的卡片显示准确反映真实进程状态。

**Architecture:** 保留两套状态系统，后端在进程管理器的所有生命周期节点同步写入 DB，前端通过 WebSocket 监听 `agent:process_status` 事件并实时更新 React Query 缓存。

**Tech Stack:** Express 5 / sql.js / React 19 / Zustand / React Query / WebSocket

---

### Task 1: 修改创建 Agent 的初始状态

**Files:**
- Modify: `packages/server/src/routes/agents.ts:52`
- Modify: `packages/server/src/routes/templates.ts:38`

**改动说明：** 两个创建 Agent 的入口（直接创建、从模板安装）都将初始 status 从 `'idle'` 改为 `'offline'`，这样新招聘员工卡片默认显示灰色「离线」，而不是误导性的「空闲」。

- [ ] **Step 1: 改 routes/agents.ts 初始状态**

```typescript
// 第 52 行：VALUES 中 'idle' 改为 'offline'
       VALUES (?, ?, ?, ?, ?, ?, 'offline', ?, ?, ?, ?, ?, ?, ?, ?)`,
```

- [ ] **Step 2: 改 routes/templates.ts 初始状态**

```typescript
// 第 38 行：VALUES 中 'idle' 改为 'offline'
       VALUES (?, ?, ?, ?, ?, 'bypass', 'offline', ?, ?, ?, ?, ?, ?, ?)`,
```

- [ ] **Step 3: 验证改动**

确认两个文件的 INSERT 语句中 status 值已改为 `'offline'`。

---

### Task 2: 进程管理器 — 就绪/运行阶段补充 DB 写入

**Files:**
- Modify: `packages/server/src/services/agent-process-manager.ts`
  - L476-484（warmup 完成 → `ready`）
  - L820-822（开始处理消息 → `running`）
  - L685-689（消息完成 → `ready`）

**改动说明：** 在这三处生命周期节点，进程管理器已发送正确的 WS 广播但缺少 DB 更新。补充 `run("UPDATE agents SET status = ?, last_activity_at = ? WHERE id = ?", [...])` 调用。

- [ ] **Step 1: 预热完成时 DB 写 `idle`**

L482 的 `broadcast` 后面加一行：

```typescript
        broadcast('agent:process_status', { agentId, status: 'idle', sessionId: session.sessionId });
        run("UPDATE agents SET status = 'idle', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);
```

- [ ] **Step 2: 开始处理消息时 DB 写 `working`**

L822 的 `broadcast` 后面加一行：

```typescript
        broadcast('agent:process_status', { agentId, status: 'running' });
        run("UPDATE agents SET status = 'working', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);
```

- [ ] **Step 3: 消息完成时 DB 写 `idle`**

L689 的 `broadcast` 后面加一行：

```typescript
        broadcast('agent:process_status', { agentId, status: 'idle', sessionId: session.sessionId });
        run("UPDATE agents SET status = 'idle', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);
```

---

### Task 3: 进程管理器 — 退出/死亡/超时场景修复 WS 广播 + DB 写入

**Files:**
- Modify: `packages/server/src/services/agent-process-manager.ts`
  - L398-400（异常退出无排队）
  - L401-404（正常退出）
  - L904（闲置超时）

**改动说明：** 这三处当前发送误导性的 `idle` 或 `error` 广播且不更新 DB。改为发送准确的 `stopped` 广播并写入 `offline`。

- [ ] **Step 1: 进程正常退出（code=0）**

L401-404 改 WS 状态 + 加 DB 写入：

```typescript
    } else {
      // code=0 且非主动停止 — CLI 正常退出（如 --max-turns 达到上限）
      session.processState = 'dead';
      run("UPDATE agents SET status = 'offline', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);
      broadcast('agent:process_status', { agentId, status: 'stopped', sessionId: session.sessionId });
    }
```

- [ ] **Step 2: 进程异常退出（code≠0 无排队消息）**

L398-400 补充 DB 写入：

```typescript
      } else {
        run("UPDATE agents SET status = 'offline', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);
        broadcast('agent:process_status', { agentId, status: 'error', error: `进程退出 code=${code}` });
      }
```

- [ ] **Step 3: 闲置超时杀掉进程**

L904 改 WS 状态 + 加 DB 写入：

```typescript
    run("UPDATE agents SET status = 'offline', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);
    broadcast('agent:process_status', { agentId, status: 'stopped', sessionId: session.sessionId });
```

---

### Task 4: 进程管理器 — 假死重建 + 服务重启清理

**Files:**
- Modify: `packages/server/src/services/agent-process-manager.ts`
  - L862-880（handleZombieProcess）
  - L249-258（restoreProcesses）

- [ ] **Step 1: 假死进程重建前发广播**

handleZombieProcess 在 L871 后面补充 DB 写入和 WS 广播（重建让用户知情）：

```typescript
  session.processState = 'dead';
  run("UPDATE agents SET status = 'offline', last_activity_at = ? WHERE id = ?", [Date.now(), agentId]);
  broadcast('agent:process_status', { agentId, status: 'stopped' });
```

- [ ] **Step 2: 服务重启清理残留增加 `idle`**

L250 的 SQL 条件补充 `'idle'`：

```typescript
  const agents = queryAll<{ id: string }>("SELECT id FROM agents WHERE status IN ('working', 'error', 'idle')");
```

---

### Task 5: 前端全局状态同步组件

**Files:**
- Create: `packages/client/src/components/agent/agent-status-sync.tsx`

**改动说明：** 新建一个零渲染组件，全局订阅 WebSocket `agent:process_status` 事件，将进程状态映射为 AgentStatus，更新 React Query 缓存。

- [ ] **Step 1: 创建组件文件**

```typescript
/**
 * Agent 状态全局同步组件
 *
 * 订阅 WebSocket agent:process_status 事件，将进程状态实时同步到
 * React Query 的 agents 缓存，使所有 Agent 卡片自动更新。
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWsMessage } from '../../hooks/use-ws.js';
import type { Agent, AgentProcessStatusPayload, AgentStatus } from '@dark-boss/shared';

// 进程状态 → 业务状态映射
const PROCESS_TO_AGENT_STATUS: Record<string, AgentStatus> = {
  starting: 'working',
  running: 'working',
  idle: 'idle',
  stopped: 'offline',
  error: 'error',
};

export function AgentStatusSync() {
  const queryClient = useQueryClient();

  useWsMessage(useCallback((msg) => {
    if (msg.type !== 'agent:process_status') return;

    const payload = msg.payload as AgentProcessStatusPayload;
    const newStatus = PROCESS_TO_AGENT_STATUS[payload.status];
    if (!newStatus) return;

    queryClient.setQueryData<Agent[]>(['agents'], (old) => {
      if (!old) return old;
      return old.map(a =>
        a.id === payload.agentId ? { ...a, status: newStatus } : a
      );
    });
  }, [queryClient]));

  return null;
}
```

- [ ] **Step 2: 挂载到 AppLayout**

在 `packages/client/src/components/layout/app-layout.tsx` 中引入 `<AgentStatusSync />`，放在 Layout 外层或内部任意位置（因为返回 null，不占 DOM）：

```typescript
import { AgentStatusSync } from '../agent/agent-status-sync.js';

// 放回到函数体顶部，Layout 之前
export function AppLayout() {
  // ... existing hooks ...
  return (
    <>
      <AgentStatusSync />
      <Layout ...>
        // ... existing layout
      </Layout>
    </>
  );
}
```

---

### 验证清单

实施完成后，手动验证以下场景：

| # | 场景 | 预期 |
|---|------|------|
| 1 | 新招聘一个员工 | 卡片显示灰色「离线」 |
| 2 | 点击启动终端 | 卡片立即变绿色「工作中」 → 预热完成后变「空闲」 |
| 3 | 在终端发一条消息 | 处理期间卡片变「工作中」，完成后回「空闲」 |
| 4 | 停止终端进程 | 卡片变灰色「离线」 |
| 5 | 杀掉终端进程（模拟 Ctrl+C） | 卡片变灰色「离线」 |
| 6 | 等待闲置超时（10 分钟） | 卡片变灰色「离线」 |
| 7 | 仪表盘/员工管理/组织架构页 | 所有页面的卡片状态一致实时更新 |
| 8 | 服务重启 | 所有 Agent 清理为「离线」 |

---

## Self-Review

**1. Spec coverage:**
- 状态映射表 → Tasks 1-4（每个映射场景都有对应改动）
- 前端实时更新 → Task 5
- 前端挂载 → Task 5 Step 2
- 服务重启清理 → Task 4 Step 2
- Chat Agent 路径 → 明确标注不在范围内
- 不改 schema / 不新增类型 → 已遵守

**2. Placeholder scan:** ✅ 无 TBD、TODO、`// 类似以上` 等占位符

**3. Type consistency:** 
- `AgentStatus` 类型是 `'idle' | 'working' | 'waiting' | 'error' | 'offline'`，映射表中只用了这五个值 ✅
- `AgentProcessStatusPayload.status` 类型是 `'starting' | 'running' | 'idle' | 'stopping' | 'stopped' | 'error'`，只映射了出现的值 ✅
- `'waiting'` 和 `'stopping'` 不在映射表中——`waiting` 不被进程管理器设置，`stopping` 是瞬态 ✅
