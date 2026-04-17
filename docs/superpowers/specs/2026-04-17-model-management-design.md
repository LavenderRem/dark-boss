# 模型管理功能设计

> 日期: 2026-04-17
> 状态: 已确认

## 背景

当前大模型配置通过 `.env` 文件管理，存在以下问题：
- 只支持单个提供商
- 修改配置需要重启服务、手动编辑文件
- API Key 明文存储在文件中
- 模型类型硬编码为 `sonnet` / `opus` / `haiku` 三种

本设计新增前端"模型设置"页面，让用户通过 UI 管理模型提供商和档位映射。

## 需求

1. **多协议支持**：支持 OpenAI 兼容 API + Anthropic API 两种协议
2. **密钥管理**：API Key 加密存储在数据库中，前端脱敏显示
3. **模型管理**：预置常见提供商和模型，支持自定义添加
4. **档位映射**：保留 haiku/sonnet/opus 三个档位，全局映射到具体模型
5. **适配 Claude Code**：当前 Agent 仅为 Claude Code CLI，档位设计与其对齐
6. **重启生效**：配置变更后，正在运行的 Agent 需重启才能使用新配置

## 数据模型

### `model_providers`（模型提供商）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| name | TEXT | 显示名称，如"智谱"、"OpenAI" |
| protocol | TEXT | `openai` 或 `anthropic` |
| base_url | TEXT | API 端点地址 |
| api_key | TEXT | AES-256-GCM 加密存储的 API Key，空字符串表示未配置 |
| is_active | INTEGER | 是否启用（1/0） |
| created_at | TEXT | ISO 时间戳 |

### `model_tier_mapping`（档位映射，固定 3 行）

| 字段 | 类型 | 说明 |
|------|------|------|
| tier | TEXT PK | `haiku` / `sonnet` / `opus` |
| provider_id | TEXT FK | 关联 model_providers.id，可为 NULL（未映射） |
| model_name | TEXT | 具体模型 ID，如 `glm-4-flash`、`gpt-4o` |
| updated_at | TEXT | ISO 时间戳 |

### 使用逻辑

```
Agent 请求 (tier: "sonnet")
  → ModelConfigService.resolve("sonnet")
  → 查 model_tier_mapping 获取 provider_id + model_name
  → 查 model_providers 获取 protocol + base_url + api_key (解密)
  → 按 protocol 构造 HTTP 请求
```

### 环境变量 Fallback

数据库未配置时，降级读取 `.env` 中的：
- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_DEFAULT_HAIKU_MODEL` / `SONNET` / `OPUS`

## API 端点

### 提供商管理

基础路径: `/api/v1/providers`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /providers | 列出所有提供商（api_key 脱敏） |
| POST | /providers | 添加提供商 |
| PATCH | /providers/:id | 更新提供商 |
| DELETE | /providers/:id | 删除提供商（被档位引用时拒绝并提示） |
| POST | /providers/:id/test | 测试连通性 |

### 档位映射

基础路径: `/api/v1/model-tiers`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /model-tiers | 获取 3 个档位的当前映射 |
| PATCH | /model-tiers/:tier | 更新档位映射 |

### API 响应格式

遵循项目现有约定：
- snake_case 数据库字段 → API 响应自动转为 camelCase
- 统一 envelope: `{ success: boolean, data?: T, error?: string }`

### API Key 脱敏规则

GET 响应中 api_key 字段：
- 未配置：返回空字符串
- 已配置：返回 `sk-***...xyz` 格式（仅显示最后 3 个字符）
- PATCH 更新时：传入完整 Key 进行保存，传 `null` 或不传则保持不变

## 预置数据

首次启动自动插入（不含 API Key）：

| 提供商 | protocol | base_url |
|--------|----------|----------|
| 智谱 (GLM) | anthropic | https://open.bigmodel.cn/api/paas/v4 |
| OpenAI | openai | https://api.openai.com/v1 |
| Anthropic | anthropic | https://api.anthropic.com |
| DeepSeek | openai | https://api.deepseek.com |

默认档位映射：指向第一个已配置 API Key 的提供商，模型名使用对应提供商的默认模型。

## 前端 UI

### 页面位置

侧边栏底部新增"模型设置"入口。

### 页面结构

分为上下两个区域：

#### 上半部分 — 提供商列表

卡片式展示，每张卡片包含：
- 提供商名称 + 状态灯（绿=已配置且启用，灰=未配置 Key，红=Key 无效）
- Base URL（可编辑输入框）
- API Key 输入框（密码模式，带显示/隐藏切换，已填显示脱敏值）
- 协议标签（`OpenAI 兼容` / `Anthropic`）
- 操作按钮：测试连接、保存、删除

底部"添加提供商"按钮 → 弹窗填写 name / protocol / base_url。

#### 下半部分 — 档位映射

表格，固定 3 行：

| 档位 | 说明 | 映射提供商 | 映射模型 | 操作 |
|------|------|-----------|---------|------|
| Haiku | 快速/低成本 | [下拉选提供商] | [输入模型名+建议] | 保存 |
| Sonnet | 平衡 | [下拉选提供商] | [输入模型名+建议] | 保存 |
| Opus | 高性能 | [下拉选提供商] | [输入模型名+建议] | 保存 |

- 下拉只列出已配置 API Key 的提供商
- 模型名提供常用建议（根据所选提供商动态提示），也可手动输入

### 交互细节

- 测试连接：loading 动画 → Ant Design Message 提示成功/失败
- 删除提供商：被档位引用时弹确认框提示
- 配置保存后：提示"正在运行的 Agent 需要重启后生效"
- API Key 保存后立即脱敏显示，前端永远拿不到完整 Key

## 后端架构

### ModelConfigService

新增服务类，职责：
- 从数据库加载提供商和档位映射配置
- `resolve(tier)` → 返回 `{ protocol, baseUrl, apiKey, modelName }`
- 启动时缓存到内存，配置变更时清缓存
- 降级到 `.env` 环境变量

### claude-client.ts 改动

- 移除硬编码的环境变量读取
- 改为调用 `ModelConfigService.resolve(tier)` 获取配置
- 根据 `protocol` 字段选择请求构造逻辑：
  - `anthropic`：保持现有格式（x-api-key header, messages body）
  - `openai`：新增 OpenAI 格式（Authorization: Bearer, /chat/completions）

### API Key 加密方案

- 算法：AES-256-GCM
- 密钥来源：环境变量 `DB_ENCRYPTION_KEY`，首次启动自动生成并写入 `.env`
- 存储格式：`iv:authTag:ciphertext`（各部分 Base64 编码）
- 使用 Node.js 内置 `crypto` 模块，无额外依赖

### 数据库迁移

新增 `model_providers` 和 `model_tier_mapping` 两张表的 migration 脚本。

## 配置生效策略

- **未运行的 Agent**：下次启动自动使用新配置
- **正在运行的 Agent**：需重启才能生效
- **提示**：配置保存后前端显示"正在运行的 Agent 需要重启后生效"
- **重启方式**：通过 Agent 卡片上的重启按钮（停止 → 启动）

## 不在范围内

- 模型价格管理和费用预算
- 模型性能对比和 benchmark
- 自动模型发现（列出提供商可用模型）
- 每个 Agent 独立绑定具体模型（仅全局档位映射）
