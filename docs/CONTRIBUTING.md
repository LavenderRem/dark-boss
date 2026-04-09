# 贡献指南

## 开发环境搭建

### 1. 安装前置依赖

- [Node.js](https://nodejs.org/) >= 20.0.0
- [pnpm](https://pnpm.io/) >= 9.0.0 (`npm install -g pnpm`)

### 2. 克隆并安装

```bash
git clone <repo-url>
cd dark-boss
pnpm install
```

### 3. 启动开发服务器

```bash
pnpm dev
```

这会同时启动：
- 后端 Express 服务器: http://localhost:3000
- 前端 Vite 开发服务器: http://localhost:5173

<!-- AUTO-GENERATED:SCRIPTS-START -->
## 可用脚本

### 根级命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 同时启动前后端开发服务器 (concurrently) |
| `pnpm dev:server` | 仅启动后端开发服务器 (tsx watch) |
| `pnpm dev:client` | 仅启动前端开发服务器 (Vite) |
| `pnpm build` | 构建所有子包 |

### 后端 (@dark-boss/server)

| 命令 | 说明 |
|------|------|
| `pnpm dev` | tsx watch 模式启动，文件变更自动重启 |
| `pnpm build` | TypeScript 编译 |
| `pnpm typecheck` | 类型检查 (tsc --noEmit) |

### 前端 (@dark-boss/client)

| 命令 | 说明 |
|------|------|
| `pnpm dev` | Vite 开发服务器 (HMR) |
| `pnpm build` | TypeScript 编译 + Vite 生产构建 |
| `pnpm preview` | 预览生产构建 |
| `pnpm typecheck` | 类型检查 (tsc --noEmit) |
<!-- AUTO-GENERATED:SCRIPTS-END -->

## 项目结构

```
dark-boss/
├── packages/
│   ├── shared/          # 共享类型、常量、工具
│   │   └── src/
│   │       ├── types/   # Agent, Department, Workflow, Task, Event 等类型
│   │       └── constants/ # 角色定义、状态颜色等常量
│   ├── server/          # Express 后端
│   │   └── src/
│   │       ├── db/      # 数据库连接、Schema、种子数据
│   │       ├── routes/  # REST API 路由 (agents, departments, templates)
│   │       ├── services/ # 业务逻辑层
│   │       ├── ws/      # WebSocket 处理
│   │       └── agent/   # Agent 控制层 (AgentManager, Process)
│   └── client/          # React 前端
│       └── src/
│           ├── pages/   # 页面组件 (dashboard, agents, canvas, ...)
│           ├── components/ # 共享组件 (layout, agent, common)
│           ├── stores/  # Zustand 状态管理
│           ├── api/     # API 客户端
│           └── styles/  # 主题和全局样式
├── CLAUDE.md            # 项目说明
└── docs/                # 文档
```

## 技术规范

### 代码风格

- TypeScript strict 模式
- 全部使用 ESModule (`"type": "module"`)
- 导入路径带 `.js` 后缀（ESM 兼容）
- 中文注释和 UI 文本，英文变量名和函数名

### 前端约定

- 组件文件名使用 kebab-case (`agent-card.tsx`)
- 页面组件放在 `pages/` 下对应的子目录中
- 共享组件放在 `components/` 下按类别组织
- 使用 Ant Design 5 组件库（深色主题）
- 状态管理：Zustand (客户端) + TanStack Query (服务器)

### 后端约定

- 路由文件在 `routes/` 目录，按资源划分
- 业务逻辑在 `services/` 层，不在路由中直接写
- 数据库操作通过 `db/connection.ts` 的 `queryAll`/`queryOne`/`run` 函数
- WebSocket 事件类型定义在 `shared/src/types/event.ts`

### 数据库

- 使用 sql.js (WASM SQLite)，无需安装原生依赖
- 数据库文件存储在 `~/.dark-boss/data.db`
- 内存数据库每 30 秒自动持久化到文件
- Schema 定义在 `server/src/db/connection.ts` 的 `createTables()` 中
- 种子数据在 `server/src/db/seed.ts`

## 提交 PR

1. 确保类型检查通过: `pnpm -r run typecheck`
2. 确保构建成功: `pnpm build`
3. 代码遵循中文注释、英文命名的规范
4. PR 描述说明改了什么、为什么改
