# Dark Boss (暗黑老板)

图形化 Claude Code 多 Agent 编排平台。用户是老板，Claude Code Agent 是员工。

## 技术栈

- TypeScript 全栈 (pnpm monorepo)
- 后端: Express 5 + sql.js (WASM SQLite) + WebSocket
- 前端: React 19 + Vite 6 + Ant Design 5 + React Flow + Zustand
- Agent 控制: Claude Agent SDK (计划中)

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

### Department (部门)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /departments | 列出所有部门 |
| POST | /departments | 创建部门 |
| DELETE | /departments/:id | 删除部门 |

### Template (招聘模板)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /templates | 列出模板 (?category= 筛选) |
| POST | /templates/:id/install | 从模板创建 Agent |

### Workflow (工作流)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /workflows | 列出工作流 |
| POST | /workflows | 创建工作流 |
| GET | /workflows/:id | 获取工作流 (含图) |
| PATCH | /workflows/:id | 保存画布 |
| DELETE | /workflows/:id | 删除工作流 |
| POST | /workflows/:id/execute | 执行工作流 |

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
