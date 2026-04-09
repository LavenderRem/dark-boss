# ADR-0004: Ant Design 5 企业级中文 UI 方案

**Date**: 2026-04-09
**Status**: accepted
**Deciders**: 用户 (LavenderRem)

## Context

Dark Boss 的 UI 风格定位是"中文企业化"——像管理一家公司的办公系统，而非游戏界面。需要选择一个提供完整企业级组件的 UI 库，支持深色主题、树形控件、表格、表单、拖拽看板等复杂交互。

## Decision

使用 Ant Design 5 作为主 UI 库，配合 Tailwind CSS 4 处理自定义样式。全部 UI 文本使用中文。

## Alternatives Considered

### shadcn/ui + Radix
- **Pros**: 高度可定制、代码直接复制到项目、视觉现代、React 生态热门
- **Cons**: 无内置树形控件（组织架构需要）、无内置表格（绩效系统需要）、中文文档较少、需要大量自定义工作
- **Why not**: 缺少 Dark Boss 核心功能所需的复杂组件（Tree、Table、Timeline、Transfer），自建成本太高

### Arco Design (字节跳动)
- **Pros**: 中文企业级 UI，设计精美，比 Ant Design 更现代的视觉风格
- **Cons**: 社区和生态远小于 Ant Design；第三方集成少；文档虽有中文但深度不如 Ant Design
- **Why not**: 生态差距。Ant Design 有 2000+ 贡献者、10 万+ GitHub Stars、大量企业实践案例

### Material UI (MUI)
- **Pros**: 国际化标准，组件丰富，TypeScript 支持好
- **Cons**: Google Material Design 风格不适合中国企业化 UI；中文社区小；打包体积大
- **Why not**: 视觉风格与中国企业办公软件不符。钉钉、飞书、企业微信风格的 UI 更适合 Ant Design

### Naive UI
- **Pros**: 中文作者，TypeScript 原生，Tree Shaking 好，主题定制灵活
- **Cons**: 社区规模小于 Ant Design；企业级复杂组件（如 ProTable、ProForm）生态缺失
- **Why not**: 虽然轻量且中文友好，但复杂企业场景的组件覆盖度不够

## Consequences

### Positive
- 中文企业级组件全覆盖：Tree（组织架构）、Table（绩效考核）、Form（创建 Agent）、Modal、Drawer、Timeline 等
- 深色主题内置支持：`theme.darkAlgorithm` 一行配置
- 中文文档质量最高：蚂蚁集团维护，钉钉、飞书风格直接对齐
- ProComponents 生态：ProTable、ProForm 等高级组件可后续引入

### Negative
- 打包体积较大（antd 全量 ~2MB，按需引入后可控）
- 设计风格偏"标准企业"，需要 Tailwind CSS 覆盖自定义视觉

### Risks
- Ant Design 6 发布时可能有破坏性变更。缓解：锁定 major 版本，升级前评估。
