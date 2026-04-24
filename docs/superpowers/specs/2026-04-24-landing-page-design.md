# Landing Page 设计文档

> 日期：2026-04-24
> 状态：已审核
> 范围：为 Dark Boss 添加独立营销展示 Landing Page

## 概述

在 `/` 路由添加一个独立的营销展示页（Landing Page），采用沉浸式全屏暗黑风格，遵循 VoltAgent 设计系统。页面无导航栏和 Footer，由三个纵向板块组成：Hero → 功能展示 → 工作流程图。

## 目标受众

兼顾技术用户（开发者）和管理者（PM、CTO），文案风格偏技术但不晦涩。

## 路由架构

| 路由 | 页面 | 布局 |
|------|------|------|
| `/` | Landing Page | 独立全屏，无 AppLayout |
| `/app` | Dashboard（原 `/`） | AppLayout 包裹 |
| `/app/agents` | Agent 管理 | AppLayout 包裹 |
| `/app/canvas` | 工作流画布 | AppLayout 包裹 |
| ... | 其他原有路由 | AppLayout 包裹 |

**改动点：**
- 新增 `LandingPage` 组件，直接挂载在 `/`，不包裹 `AppLayout`
- 原有所有路由加上 `/app` 前缀
- `App.tsx` 中 `AppLayout` 包裹的路由组改为以 `/app` 为基础路径
- CTA "进入应用" 链接到 `/app`

## 技术依赖

新增一个依赖：
- `lucide-react` — 轻量 SVG 图标库，用于功能展示区和工作流区图标

## 页面结构

### 1. Hero 区（全屏 100vh）

**布局：** 垂直居中，所有内容居中对齐。

**背景：**
- 基础色 `#050507`（Abyss Black）
- 渐变：`linear-gradient(180deg, #050507 0%, #040a08 40%, #050507 100%)`
- CSS 粒子效果：散布绿色小圆点（`#00d992`），带 `box-shadow` 发光，纯 CSS 实现
- 淡绿水平网格线（极低透明度 `#3d3a3920`），增加空间感

**内容组成（从上到下）：**

1. **Badge 标签**
   - 样式：圆角胶囊（`border-radius: 9999px`），`#101010` 背景 + `#3d3a39` 边框
   - 左侧绿色小圆点（带发光 `box-shadow: 0 0 8px #00d992`）
   - 文字：`DARK BOSS — Multi-Agent Platform`，`#b8b3b0`，12px，大写，字间距 1.5px

2. **主标题**
   - 字体：system-ui，52px，font-weight 700，`#f2f2f2`
   - 第一行："你是老板"
   - 第二行："AI Agent 是你的员工"，颜色 `#00d992`
   - 绿色文字下方有弧线 SVG 装饰（`opacity: 0.4`）

3. **副标题**
   - 18px，`#b8b3b0`，行高 1.6，最大宽度 520px
   - 文案："图形化编排多个 Claude Code Agent，让 AI 团队像真实员工一样高效协作"

4. **CTA 按钮组**
   - 主按钮：`#00d992` 背景 + `#050507` 文字，14px 36px，圆角 6px，font-weight 600
     - 文案："进入应用 →"
     - 链接到 `/app`
   - 次按钮：`#3d3a39` 边框 + `#f2f2f2` 文字，同等尺寸
     - 文案："GitHub"（带 GitHub SVG 图标）
     - 链接到项目 GitHub 仓库

5. **数据统计行**
   - 三组数据，水平排列，间距 40px
   - 每组：绿色数字（24px, 700）+ 灰色说明文字（12px, `#8b949e`）
   - 内容：`7+` 模板 / `∞` 工作流 / `实时监控`

6. **滚动指示器**
   - 固定在 Hero 区底部居中
   - 文字 "SCROLL"（11px, `#8b949e`）+ 向下渐隐线条

### 2. 功能展示区

**布局：** 居中，最大宽度 700px。

**区域标题：**
- 标签：`CORE FEATURES`，`#00d992`，12px，letter-spacing 2px
- 标题："核心能力"，32px，`#f2f2f2`，font-weight 700
- 副标题："从招聘到执行，一站式管理你的 AI 团队"，`#8b949e`，15px

**卡片网格：** 2×2 grid，gap 16px。

每张卡片：
- 背景：`#101010`（Carbon Surface）
- 边框：1px solid `#3d3a39`（Warm Charcoal）
- 圆角：8px
- 内边距：24px
- Hover 效果：边框颜色变为 `#00d992`

卡片内容结构：
- 图标容器：40×40px，`#0a0a0c` 背景 + `#3d3a39` 边框，圆角 6px
- Lucide 图标：20×20px，`#00d992` 描边，stroke-width 1.5
- 标题：16px，`#f2f2f2`，font-weight 600
- 描述：13px，`#8b949e`，行高 1.5

四张卡片内容：

| 图标 (Lucide) | 标题 | 描述 |
|------|------|------|
| Users | Agent 管理 | 7 种预置角色模板，一键雇佣前端、后端、架构师等专业 Agent，像管理团队一样管理 AI |
| GitBranch | 工作流画布 | 可视化拖拽编排 Agent 协作流程，定义任务依赖和执行顺序，复杂的 AI 协作一目了然 |
| Terminal | 实时终端 | 每位 Agent 配备独立终端，实时查看执行过程、代码输出和日志，完全透明可控 |
| LayoutGrid | 看板协作 | 任务看板追踪工作进度，工作流执行状态实时同步，团队协作井然有序 |

### 3. 工作流程图区

**布局：** 居中，最大宽度 800px。

**区域标题：**
- 标签：`HOW IT WORKS`，`#00d992`，12px，letter-spacing 2px
- 标题："三步启动 AI 团队"，32px，`#f2f2f2`，font-weight 700
- 副标题："简单直觉，从雇佣到交付只需三步"，`#8b949e`，15px

**三步横向流程：**

每个步骤：
- 图标容器：72×72px，`#101010` 背景，圆角 12px
- 第一步边框 `#00d992`（2px，高亮），后续步骤边框 `#3d3a39`（2px，灰色）
- Lucide 图标：28×28px，与边框同色描边
- 右上角序号圆点：24×24px，与边框同色背景，`#f2f2f2` 文字（第一步为 `#050507` 文字）
- 标题：17px，`#f2f2f2`，font-weight 600
- 描述：13px，`#8b949e`，行高 1.5，最大宽度 200px

步骤间连接线：
- 宽度 60px，2px 高
- 第一步到第二步：渐变 `linear-gradient(90deg, #00d992, #3d3a39)` + 右侧箭头
- 第二步到第三步：`#3d3a39` 纯色 + 右侧箭头

三步内容：

| 序号 | 图标 (Lucide) | 标题 | 描述 |
|------|------|------|------|
| 1 | UserPlus | 雇佣 Agent | 从模板市场选择角色，配置技能和权限，组建你的 AI 团队 |
| 2 | LayoutGrid | 编排工作流 | 在画布上拖拽连接 Agent 节点，定义任务流和执行顺序 |
| 3 | Play | 执行监控 | 一键启动工作流，实时终端跟踪每个 Agent 的执行状态 |

**底部 CTA：**
- 区域底部，上方 `border-top: 1px solid #3d3a3920`
- 绿色按钮："立即开始 →"，样式同 Hero 主 CTA
- 链接到 `/app`

## 文件结构

```
packages/client/src/
  pages/
    landing/
      index.tsx              # LandingPage 主组件
      hero-section.tsx       # Hero 区
      features-section.tsx   # 功能展示区
      workflow-section.tsx   # 工作流程图区
  App.tsx                    # 更新路由：/ → Landing, /app/* → 主应用
```

## 样式方案

- 使用项目已有的 `styles/design-tokens.css` 中的 CSS 变量
- 粒子效果和布局样式使用组件级 CSS（CSS Modules 或内联样式），不新增全局样式文件
- Hover 动效用纯 CSS `transition`，不依赖 JS 动画库

## 不在范围内

- 导航栏和 Footer（明确排除）
- 用户认证/登录页
- 响应式移动端适配（首期仅桌面端）
- 动画库引入（纯 CSS 实现）
- SEO 优化（meta tags 等后续添加）
