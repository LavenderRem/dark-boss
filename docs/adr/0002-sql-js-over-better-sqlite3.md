# ADR-0002: sql.js (WASM) 替代 better-sqlite3

**Date**: 2026-04-09
**Status**: accepted
**Deciders**: 用户 (LavenderRem)

## Context

项目需要嵌入式数据库存储 Agent、部门、工作流等数据。最初计划使用 better-sqlite3 + Drizzle ORM 方案（参考 Tide Commander 的实践）。但在 Windows 11 环境下，better-sqlite3 需要编译 C++ 原生模块 (node-gyp)，而 pnpm 的构建审批机制 (`pnpm approve-builds`) 交互式命令在当前 shell 环境中不可用，导致原生模块始终无法编译成功。

## Decision

使用 sql.js（基于 Emscripten 编译的 WASM 版 SQLite）替代 better-sqlite3 作为数据库驱动。放弃 Drizzle ORM，改用轻量级的手写 DAO 层（`queryAll`/`queryOne`/`run` 辅助函数）。

## Alternatives Considered

### better-sqlite3 + Drizzle ORM
- **Pros**: Drizzle ORM 提供类型安全的 Schema 定义、迁移、查询构建器；better-sqlite3 是 Node.js 生态中最快的 SQLite 驱动（原生 C++ 绑定）；Tide Commander 已验证可行
- **Cons**: Windows 上需要 node-gyp + Visual Studio Build Tools 编译；pnpm 的构建审批流程在当前环境有兼容性问题；原生模块在不同 Node.js 版本间需要重新编译
- **Why not**: 在当前 Windows 环境中原生模块编译失败，阻塞了项目启动。原生编译问题是持续性的环境依赖风险。

### IndexedDB (浏览器端)
- **Pros**: 零依赖，浏览器原生支持
- **Cons**: 只能在前端使用，后端无法访问；无 SQL 查询能力；数据模型不适合复杂关联查询
- **Why not**: 后端需要独立于浏览器运行，且需要 SQL 查询能力

### LowDB (JSON 文件)
- **Pros**: 纯 JS，零原生依赖，简单
- **Cons**: 不支持复杂查询、事务、索引；数据量增大后性能差；无结构化 Schema 保证
- **Why not**: 缺乏 SQL 能力，不适合 10+ 张表的关系型数据

## Consequences

### Positive
- 零原生编译：sql.js 是纯 WASM，任何平台 `pnpm install` 直接可用
- 跨平台一致性：Windows/macOS/Linux 行为完全一致
- 体积可控：sql.js WASM 文件约 1.5MB

### Negative
- 性能差距：sql.js 比原生 better-sqlite3 慢 2-5 倍（对单用户桌面应用影响可忽略）
- 无 ORM：手写 SQL 字符串，失去类型安全的查询构建器
- 内存数据库需手动持久化：sql.js 运行在内存中，需要定时 save() 到文件

### Risks
- 手写 SQL 可能引入拼写错误或类型不一致。缓解：shared 包中定义 TypeScript 类型，DAO 层返回类型强制匹配。
- 内存数据库在进程崩溃时可能丢失最近 30 秒的数据。缓解：关键写操作后立即 save()，定期持久化间隔可调。
