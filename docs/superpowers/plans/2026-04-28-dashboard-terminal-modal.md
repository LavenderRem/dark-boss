# 仪表盘员工终端弹窗 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在仪表盘页面点击员工卡片，直接弹出该员工的终端交互界面。

**Architecture:** 在 DashboardPage 组件中添加 Modal + AgentTerminal，复用现有终端组件和 WebSocket 通信层。点击卡片即打开全屏终端弹窗，无需中间 Tab 导航。

**Tech Stack:** React 19, Ant Design Modal, AgentTerminal 组件, Zustand store, WebSocket

---

## 文件变更清单

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `packages/client/src/pages/dashboard/index.tsx` | 添加点击事件、Modal 状态、终端弹窗 UI |

> 仅需修改一个文件。AgentTerminal、ContextMeter、WebSocket hook 均已存在且可直接复用。

---

### Task 1: 为仪表盘添加员工终端弹窗

**Files:**
- 修改: `packages/client/src/pages/dashboard/index.tsx`

- [ ] **Step 1: 添加 import 和状态声明**

在文件顶部添加必要的 import：

```tsx
import { useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Modal } from 'antd';
import {
  TeamOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import type { Agent } from '@dark-boss/shared';
import { AGENT_ROLES, AGENT_STATUS_LABELS, AGENT_STATUS_COLORS } from '@dark-boss/shared';
import { AgentTerminal } from '../../components/agent/agent-terminal.js';
import { ContextMeter } from '../../components/agent/context-meter.js';
```

在 `DashboardPage` 函数体内，`useQuery` 之后添加状态：

```tsx
const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
```

- [ ] **Step 2: 添加点击处理函数**

在状态声明之后添加：

```tsx
const handleAgentClick = (agent: Agent) => {
  setSelectedAgent(agent);
};
```

- [ ] **Step 3: 为员工卡片添加 onClick 事件**

将员工网格中 `<Card>` 组件添加 `onClick` 属性：

```tsx
<Card
  hoverable
  onClick={() => handleAgentClick(agent)}
  style={{
    background: '#101010',
    borderTop: `3px solid ${AGENT_STATUS_COLORS[agent.status]}`,
    cursor: 'pointer',
  }}
  size="small"
>
```

- [ ] **Step 4: 添加终端弹窗 Modal**

在 `DashboardPage` 的 `return` 的 `</div>` 闭合标签之前，添加 Modal：

```tsx
{/* 员工终端弹窗 */}
<Modal
  title={selectedAgent ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {`${AGENT_ROLES[selectedAgent.role]?.icon || ''} ${selectedAgent.name}`}
      <ContextMeter agentId={selectedAgent.id} size={28} showLabel={false} />
    </span>
  ) : '员工终端'}
  open={!!selectedAgent}
  onCancel={() => setSelectedAgent(null)}
  footer={null}
  width={960}
  styles={{ body: { padding: 0 } }}
  destroyOnClose
>
  {selectedAgent && (
    <AgentTerminal
      agentId={selectedAgent.id}
      agentName={selectedAgent.name}
      height={500}
    />
  )}
</Modal>
```

- [ ] **Step 5: 验证构建通过**

运行: `pnpm --filter @dark-boss/client typecheck`
预期: 无类型错误

- [ ] **Step 6: 手动测试**

1. 运行 `pnpm dev`
2. 打开 http://localhost:5173/app
3. 点击任一员工卡片 → 应弹出终端 Modal
4. 点击 Modal 右上角 X 或遮罩层 → Modal 关闭
5. 终端内工具栏（启动/停止/重启/清屏）应正常工作
6. 输入框可输入并发送消息

- [ ] **Step 7: 提交**

```bash
git add packages/client/src/pages/dashboard/index.tsx
git commit -m "feat(dashboard): 点击员工卡片弹出终端交互界面"
```
