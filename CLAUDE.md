# Dark Boss 

图形化 Claude Code 多 Agent 编排平台。用户是老板，Claude Code Agent 是员工。

## 技术栈

- TypeScript 全栈 (pnpm monorepo)
- 后端: Express 5 + sql.js (WASM SQLite) + WebSocket
- 前端: React 19 + Vite 6 + Ant Design 5 + React Flow + Zustand
- Agent 控制: Claude CLI 流式会话模式 (`--input-format stream-json`)

## 前置要求

- Node.js >= 20.0.0
- pnpm >= 9.0.0

## 开发

```bash
pnpm install
pnpm dev
```

- 前端: http://localhost:5173
- 后端 API: http://localhost:3000

<!-- AUTO-GENERATED:SCRIPTS-START -->
## 可用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 同时启动前后端开发服务器 |
| `pnpm dev:server` | 仅启动后端 (端口 3000) |
| `pnpm dev:client` | 仅启动前端 (端口 5173) |
| `pnpm build` | 构建所有子包 |
| `pnpm db:generate` | 生成数据库迁移 |
| `pnpm db:migrate` | 执行数据库迁移 |
| `pnpm db:seed` | 填充数据库种子数据 |
| `pnpm --filter @dark-boss/server typecheck` | 后端类型检查 |
| `pnpm --filter @dark-boss/client typecheck` | 前端类型检查 |
<!-- AUTO-GENERATED:SCRIPTS-END -->

<!-- AUTO-GENERATED:API-START -->
## API 端点

基础路径: `/api/v1`

### Agent (员工)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /agents | 列出所有 Agent |
| GET | /agents/:id | 获取单个 Agent |
| POST | /agents | 创建 Agent |
| PATCH | /agents/:id | 更新 Agent |
| DELETE | /agents/:id | 删除 Agent |
| GET | /agents/:id/events | 获取 Agent 终端事件 |
| GET | /agents/:id/sessions | 获取 Agent 会话列表 |
| POST | /agents/:id/sessions/:sessionId/restore | 恢复会话 |
| GET | /agents/:id/context | 获取 Agent 上下文 |

### Agent 进程 (通过 WebSocket)

| 消息类型 | 方向 | 说明 |
|---------|------|------|
| agent:spawn | 客户端→服务器 | 启动 Agent 持久进程 |
| agent:stop | 客户端→服务器 | 停止 Agent 进程 |
| agent:restart | 客户端→服务器 | 重启 Agent 进程 |
| agent:send_message | 客户端→服务器 | 向 Agent 发送消息 |
| agent:permission_response | 客户端→服务器 | 响应权限请求 |
| agent:terminal_event | 服务器→客户端 | 类型化终端事件流 |
| agent:process_status | 服务器→客户端 | 进程状态变更 |

### Department (部门)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /departments | 列出所有部门 |
| POST | /departments | 创建部门 |
| DELETE | /departments/:id | 删除部门 |
| PATCH | /departments/:id | 更新部门 |
| POST | /departments/:id/move | 移动部门排序 |

### Template (招聘模板)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /templates | 列出模板 (?category= 筛选) |
| POST | /templates/:id/install | 从模板创建 Agent |
| POST | /templates/:id/rate | 模板评分 |

### Workflow (工作流)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /workflows | 列出工作流 |
| POST | /workflows | 创建工作流 |
| GET | /workflows/:id | 获取工作流 (含图) |
| PATCH | /workflows/:id | 保存画布 |
| DELETE | /workflows/:id | 删除工作流 |
| POST | /workflows/:id/execute | 执行工作流 |
| GET | /workflows/:id/executions | 获取执行记录 |
| GET | /workflows/:id/executions/latest | 获取最近执行 |
| GET | /workflows/:id/executions/:executionId | 获取执行详情 |

### Task (任务)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /tasks | 列出任务 |
| GET | /tasks/by-workflow/:workflowId | 按工作流筛选 |
| GET | /tasks/:id | 获取单个任务 |
| POST | /tasks | 创建任务 |
| PATCH | /tasks/:id | 更新任务 |
| PATCH | /tasks/:id/move | 移动任务 |
| POST | /tasks/agent/:agentId/pull-task | Agent 拉取任务 |
| POST | /tasks/:id/assign/:agentId | 分配任务给 Agent |
| POST | /tasks/:id/execute | 执行任务 |
| DELETE | /tasks/:id | 删除任务 |
| POST | /tasks/delegate | 委派任务 |

### Chat (聊天)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /chat/channels | 列出频道 |
| POST | /chat/channels | 创建频道 |
| GET | /chat/channels/:id/messages | 获取消息列表 |
| POST | /chat/channels/:id/messages | 发送消息 |

### File (文件)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /files/tree | 获取文件树 |
| GET | /files/content | 获取文件内容 |
| GET | /files/changes | 获取文件变更 |
| POST | /files/diff | 计算文件差异 |

### Provider (模型提供商)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /providers | 列出提供商 |
| POST | /providers | 创建提供商 |
| PATCH | /providers/:id | 更新提供商 |
| DELETE | /providers/:id | 删除提供商 |
| POST | /providers/:id/test | 测试连接 |

### Model Tier (模型层级)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /model-tiers | 列出模型层级 |
| PATCH | /model-tiers/:tier | 更新模型层级配置 |

### Performance (绩效)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /performance/dashboard | 绩效仪表盘 |
| GET | /performance/trend | 绩效趋势 |
| GET | /performance/agents | Agent 绩效列表 |
| GET | /performance/agents/:id | 单个 Agent 绩效 |
| GET | /performance/agents/:id/report | 生成绩效报告 |

### System

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |

## 前后端数据约定

- 数据库使用 **snake_case**（如 `department_id`、`created_at`）
- API 客户端（`packages/client/src/api/client.ts`）自动将响应从 snake_case 转为 **camelCase**
- 前端统一使用 camelCase（如 `departmentId`、`createdAt`），与共享类型一致
- 前端请求体（发给后端）使用 camelCase，后端路由层负责映射到 snake_case 写入数据库

## 项目结构

```
packages/
  shared/    # 共享类型、常量
  server/    # Express 后端
  client/    # React 前端
```

## 数据存储

- 数据库文件: `~/.dark-boss/data.db` (sql.js WASM SQLite)
- 首次启动自动初始化默认数据 (4 个部门 + 7 个模板)

## 前端 UI 设计规范（强制）

**所有涉及前端 UI 的代码（组件、样式、页面）必须遵循 `DESIGN.md` 中定义的 VoltAgent 设计系统。**

### 快速颜色参考（写代码时直接使用）
- 主色调: `#00d992` (Emerald Signal Green) — 用于强调、活跃状态、CTA
- 按钮文字: `#2fd6a1` (VoltAgent Mint)
- 页面背景: `#050507` (Abyss Black)
- 卡片/容器: `#101010` (Carbon Surface)
- 输入框背景: `#0a0a0c`
- 边框: `#3d3a39` (Warm Charcoal)
- 强调边框: `#00d992`
- 主要文字: `#f2f2f2` (Snow White)
- 次要文字: `#b8b3b0` (Warm Parchment)
- 辅助文字: `#8b949e` (Steel Slate)
- 成功: `#00d992` / 警告: `#ffba00` / 危险: `#fb565b` / 信息: `#4cb3d4`

### 强制规则
1. **禁止使用蓝色** — 不允许 `#1890ff` 或任何蓝色作为主色
2. **使用设计令牌** — 优先使用 `var(--color-*)` CSS 变量（定义在 `styles/design-tokens.css`）
3. **边框驱动深度** — 用边框颜色和粗细表达层级，而非阴影
4. **字体规范** — 标题用 system-ui，正文用 Inter，代码用 JetBrains Mono
5. **圆角规范** — 小元素 4px，按钮 6px，卡片 8px，标签 9999px
6. **详细规范见 `DESIGN.md`** — 涉及 UI 变更时必须先读 DESIGN.md

### Ant Design 主题
- 已在 `main.tsx` 中配置，基于 `theme.darkAlgorithm`
- 组件级 token 在 `themeConfig.components` 中定义
- 新增 Ant Design 组件时，检查是否需要补充组件级 token

## 默认 Agent 模板

| 模板 | 角色 | 说明 |
|------|------|------|
| 前端开发工程师 | frontend | React/Vue/TypeScript |
| 后端开发工程师 | backend | Node.js/Python/API |
| 全栈开发工程师 | fullstack | 前后端兼顾 |
| 架构师 | architect | 系统设计、代码审查 |
| 测试工程师 | tester | 测试用例、质量保障 |
| 运维工程师 | devops | CI/CD、Docker |
| 产品经理 | pm | 需求分析、PRD |
