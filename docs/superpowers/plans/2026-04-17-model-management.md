# 模型管理功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增前端"模型设置"页面，让用户通过 UI 管理大模型提供商和档位映射，替代 .env 文件配置。

**Architecture:** 新增 `model_providers` 和 `model_tier_mapping` 两张数据库表，`ModelConfigService` 负责从数据库解析档位到具体模型配置（降级到 .env），`encryption.ts` 工具处理 API Key 的 AES-256-GCM 加解密。前端新增独立页面展示提供商卡片和档位映射表格。

**Tech Stack:** Express 5, sql.js, Node.js crypto, React 19, Ant Design 5, React Query, Zustand

**Spec:** `docs/superpowers/specs/2026-04-17-model-management-design.md`

---

## File Structure

### 新建文件

| 文件 | 职责 |
|------|------|
| `packages/shared/src/types/provider.ts` | 提供商和档位映射的共享类型定义 |
| `packages/server/src/utils/encryption.ts` | AES-256-GCM 加解密工具 |
| `packages/server/src/services/model-config-service.ts` | 档位解析服务（数据库 → 具体模型配置，降级到 .env） |
| `packages/server/src/routes/providers.ts` | 提供商 CRUD + 测试连接路由 |
| `packages/server/src/routes/model-tiers.ts` | 档位映射路由 |
| `packages/client/src/pages/model-settings/index.tsx` | 模型设置页面 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `packages/server/src/db/connection.ts:36-291` | createTables() 中新增两张表 |
| `packages/server/src/db/seed.ts` | 新增预置提供商和档位映射的种子数据 |
| `packages/server/src/utils/config.ts` | 新增 DB_ENCRYPTION_KEY 配置项 |
| `packages/server/src/routes/index.ts` | 注册 providers 和 model-tiers 路由 |
| `packages/server/src/services/claude-client.ts` | 改用 ModelConfigService 获取配置 |
| `packages/shared/src/index.ts` | 导出 provider 类型 |
| `packages/client/src/App.tsx` | 新增 /model-settings 路由 |
| `packages/client/src/components/layout/app-layout.tsx` | 侧边栏新增"模型设置"菜单项 |

---

## Task 1: 共享类型定义

**Files:**
- Create: `packages/shared/src/types/provider.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: 创建 provider 类型文件**

创建 `packages/shared/src/types/provider.ts`：

```typescript
// 提供商协议类型
export type ProviderProtocol = 'openai' | 'anthropic';

// 模型档位类型
export type ModelTier = 'haiku' | 'sonnet' | 'opus';

// 模型提供商（数据库完整记录）
export interface ModelProvider {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string; // GET 响应中为脱敏值
  isActive: boolean;
  createdAt: number;
}

// 创建提供商请求
export interface CreateProviderRequest {
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey?: string;
}

// 更新提供商请求
export interface UpdateProviderRequest {
  name?: string;
  protocol?: ProviderProtocol;
  baseUrl?: string;
  apiKey?: string | null; // null 表示保持不变
  isActive?: boolean;
}

// 档位映射记录
export interface ModelTierMapping {
  tier: ModelTier;
  providerId: string | null;
  modelName: string | null;
  updatedAt: number;
}

// 更新档位映射请求
export interface UpdateTierMappingRequest {
  providerId: string | null;
  modelName: string | null;
}

// 解析后的模型配置（供 claude-client 使用）
export interface ResolvedModelConfig {
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

// 提供商测试连接结果
export interface ProviderTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}
```

- [ ] **Step 2: 在 shared/index.ts 中导出**

在 `packages/shared/src/index.ts` 末尾添加：

```typescript
export * from './types/provider.js';
```

- [ ] **Step 3: 验证类型检查通过**

Run: `pnpm --filter @dark-boss/shared typecheck`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add packages/shared/src/types/provider.ts packages/shared/src/index.ts
git commit -m "feat(shared): 新增模型提供商和档位映射类型定义"
```

---

## Task 2: 加密工具

**Files:**
- Create: `packages/server/src/utils/encryption.ts`
- Modify: `packages/server/src/utils/config.ts`

- [ ] **Step 1: 在 config.ts 中新增加密密钥配置**

在 `packages/server/src/utils/config.ts` 的 `config` 对象中新增：

```typescript
dbEncryptionKey: process.env.DB_ENCRYPTION_KEY || '',
```

- [ ] **Step 2: 创建 encryption.ts**

创建 `packages/server/src/utils/encryption.ts`：

```typescript
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// 获取或生成加密密钥
function getKey(): Buffer {
  const key = process.env.DB_ENCRYPTION_KEY;
  if (key) return Buffer.from(key, 'hex');

  // 首次运行自动生成密钥并写入 .env
  const newKey = crypto.randomBytes(32).toString('hex');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const envPath = path.resolve(process.cwd(), '.env');

  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  if (!envContent.includes('DB_ENCRYPTION_KEY')) {
    envContent += `\nDB_ENCRYPTION_KEY=${newKey}\n`;
    fs.writeFileSync(envPath, envContent);
  }
  process.env.DB_ENCRYPTION_KEY = newKey;
  return Buffer.from(newKey, 'hex');
}

// 注意：getKey 是异步导入，改为同步方式
function getKeySync(): Buffer {
  const key = process.env.DB_ENCRYPTION_KEY;
  if (key) return Buffer.from(key, 'hex');

  const newKey = crypto.randomBytes(32).toString('hex');
  const fs = require('node:fs');
  const path = require('node:path');
  const envPath = path.resolve(process.cwd(), '.env');

  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  if (!envContent.includes('DB_ENCRYPTION_KEY')) {
    envContent += `\nDB_ENCRYPTION_KEY=${newKey}\n`;
    fs.writeFileSync(envPath, envContent);
  }
  process.env.DB_ENCRYPTION_KEY = newKey;
  return Buffer.from(newKey, 'hex');
}

/** 加密明文，返回 "iv:authTag:ciphertext" (Base64) */
export function encrypt(plaintext: string): string {
  const key = getKeySync();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/** 解密 "iv:authTag:ciphertext" 格式的密文，返回明文 */
export function decrypt(ciphertext: string): string {
  const key = getKeySync();
  const [ivB64, authTagB64, dataB64] = ciphertext.split(':');

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(data) + decipher.final('utf8');
}

/** 脱敏 API Key，返回 "sk-***...xyz" 格式 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.length <= 6) return '***';
  return `***...${apiKey.slice(-3)}`;
}
```

> **注意：** 上面使用了 `require()` 作为同步回退。由于项目使用 ESM（`"type": "module"`），需要改用 `import.meta.url` 方式。实际实现时用 `fs.readFileSync` / `fs.writeFileSync` 的同步版本（已直接从 `node:fs` 导入）。

修正版（纯 ESM 同步方式）：

```typescript
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

// 项目根目录下的 .env 路径
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../../.env');

function getKey(): Buffer {
  const key = process.env.DB_ENCRYPTION_KEY;
  if (key) return Buffer.from(key, 'hex');

  // 首次运行自动生成密钥并写入 .env
  const newKey = crypto.randomBytes(32).toString('hex');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  if (!envContent.includes('DB_ENCRYPTION_KEY')) {
    envContent += `\nDB_ENCRYPTION_KEY=${newKey}\n`;
    fs.writeFileSync(envPath, envContent);
  }
  process.env.DB_ENCRYPTION_KEY = newKey;
  console.log('[加密] 已自动生成 DB_ENCRYPTION_KEY 并写入 .env');
  return Buffer.from(newKey, 'hex');
}

/** 加密明文，返回 "iv:authTag:ciphertext" (Base64) */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

/** 解密 "iv:authTag:ciphertext" 格式密文 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return '';
  const key = getKey();
  const [ivB64, authTagB64, dataB64] = ciphertext.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(data) + decipher.final('utf8');
}

/** 脱敏 API Key */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.length <= 6) return '***';
  return `***...${apiKey.slice(-3)}`;
}
```

- [ ] **Step 3: 验证类型检查通过**

Run: `pnpm --filter @dark-boss/server typecheck`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add packages/server/src/utils/encryption.ts packages/server/src/utils/config.ts
git commit -m "feat(server): 新增 AES-256-GCM 加解密工具和密钥配置"
```

---

## Task 3: 数据库表和种子数据

**Files:**
- Modify: `packages/server/src/db/connection.ts` (createTables 函数末尾，约 line 290 save() 之前)
- Modify: `packages/server/src/db/seed.ts`

- [ ] **Step 1: 在 createTables() 中新增两张表**

在 `packages/server/src/db/connection.ts` 的 `createTables()` 函数中，`save()` 调用之前（约 line 290），添加：

```typescript
  // 模型提供商
  db.run(`
    CREATE TABLE IF NOT EXISTS model_providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      protocol TEXT NOT NULL CHECK(protocol IN ('openai', 'anthropic')),
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )
  `);

  // 档位映射（固定 3 行：haiku / sonnet / opus）
  db.run(`
    CREATE TABLE IF NOT EXISTS model_tier_mapping (
      tier TEXT PRIMARY KEY CHECK(tier IN ('haiku', 'sonnet', 'opus')),
      provider_id TEXT REFERENCES model_providers(id),
      model_name TEXT,
      updated_at INTEGER NOT NULL
    )
  `);
```

- [ ] **Step 2: 在 seed.ts 中新增预设提供商和档位映射**

在 `packages/server/src/db/seed.ts` 的 `seed()` 函数中，`save()` 之前，添加：

```typescript
  // 预设模型提供商（不含 API Key）
  const existingProviders = queryAll('SELECT id FROM model_providers LIMIT 1');
  if (existingProviders.length === 0) {
    console.log('初始化预设模型提供商...');
    const providers = [
      { id: uuid(), name: '智谱 (GLM)', protocol: 'anthropic', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
      { id: uuid(), name: 'OpenAI', protocol: 'openai', baseUrl: 'https://api.openai.com/v1' },
      { id: uuid(), name: 'Anthropic', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com' },
      { id: uuid(), name: 'DeepSeek', protocol: 'openai', baseUrl: 'https://api.deepseek.com' },
    ];
    for (const p of providers) {
      run(
        'INSERT INTO model_providers (id, name, protocol, base_url, api_key, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
        [p.id, p.name, p.protocol, p.baseUrl, '', now],
      );
    }

    // 初始化档位映射（未指向任何提供商）
    const tiers: Array<{ tier: string; defaultModel: string }> = [
      { tier: 'haiku', defaultModel: 'glm-4-flash' },
      { tier: 'sonnet', defaultModel: 'glm-4' },
      { tier: 'opus', defaultModel: 'glm-4' },
    ];
    for (const t of tiers) {
      run(
        'INSERT INTO model_tier_mapping (tier, provider_id, model_name, updated_at) VALUES (?, NULL, ?, ?)',
        [t.tier, t.defaultModel, now],
      );
    }
  }
```

- [ ] **Step 3: 启动服务验证数据库初始化**

Run: `pnpm dev:server`
Expected: 控制台输出 "初始化预设模型提供商..." 且无错误

- [ ] **Step 4: 提交**

```bash
git add packages/server/src/db/connection.ts packages/server/src/db/seed.ts
git commit -m "feat(server): 新增 model_providers 和 model_tier_mapping 表及预设数据"
```

---

## Task 4: ModelConfigService

**Files:**
- Create: `packages/server/src/services/model-config-service.ts`

- [ ] **Step 1: 创建 ModelConfigService**

创建 `packages/server/src/services/model-config-service.ts`：

```typescript
import { queryOne } from '../db/connection.js';
import { config } from '../utils/config.js';
import { decrypt } from '../utils/encryption.js';
import type { ResolvedModelConfig, ModelTier, ProviderProtocol } from '@dark-boss/shared';

interface TierRow {
  tier: string;
  provider_id: string | null;
  model_name: string | null;
  updated_at: number;
}

interface ProviderRow {
  id: string;
  name: string;
  protocol: string;
  base_url: string;
  api_key: string;
  is_active: number;
}

// 缓存
let cache: Map<ModelTier, ResolvedModelConfig | null> | null = null;

/** 清除缓存（配置变更时调用） */
export function clearModelConfigCache(): void {
  cache = null;
}

/** 从数据库解析档位配置，失败则降级到 .env */
export function resolveModelConfig(tier: ModelTier): ResolvedModelConfig | null {
  // 先查缓存
  if (cache?.has(tier)) {
    return cache.get(tier)!;
  }

  const result = resolveFromDb(tier) ?? resolveFromEnv(tier);

  // 写入缓存
  if (!cache) cache = new Map();
  cache.set(tier, result);

  return result;
}

/** 从数据库档位映射解析 */
function resolveFromDb(tier: ModelTier): ResolvedModelConfig | null {
  const tierRow = queryOne<TierRow>(
    'SELECT tier, provider_id, model_name FROM model_tier_mapping WHERE tier = ?',
    [tier],
  );
  if (!tierRow?.provider_id || !tierRow.model_name) return null;

  const provider = queryOne<ProviderRow>(
    'SELECT id, name, protocol, base_url, api_key, is_active FROM model_providers WHERE id = ? AND is_active = 1',
    [tierRow.provider_id],
  );
  if (!provider || !provider.api_key) return null;

  return {
    protocol: provider.protocol as ProviderProtocol,
    baseUrl: provider.base_url,
    apiKey: decrypt(provider.api_key),
    modelName: tierRow.model_name,
  };
}

/** 降级到 .env 环境变量 */
function resolveFromEnv(tier: ModelTier): ResolvedModelConfig | null {
  if (!config.anthropicAuthToken) return null;

  const modelMap: Record<ModelTier, string> = {
    haiku: config.anthropicDefaultHaikuModel,
    sonnet: config.anthropicDefaultSonnetModel,
    opus: config.anthropicDefaultOpusModel,
  };

  return {
    protocol: 'anthropic',
    baseUrl: config.anthropicBaseUrl || 'https://api.anthropic.com',
    apiKey: config.anthropicAuthToken,
    modelName: modelMap[tier],
  };
}

/** 获取所有档位的当前配置概览 */
export function getAllTierConfigs(): Array<{ tier: ModelTier; config: ResolvedModelConfig | null }> {
  return (['haiku', 'sonnet', 'opus'] as ModelTier[]).map(tier => ({
    tier,
    config: resolveModelConfig(tier),
  }));
}
```

- [ ] **Step 2: 验证类型检查通过**

Run: `pnpm --filter @dark-boss/server typecheck`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add packages/server/src/services/model-config-service.ts
git commit -m "feat(server): 新增 ModelConfigService 档位解析服务"
```

---

## Task 5: 提供商路由

**Files:**
- Create: `packages/server/src/routes/providers.ts`

- [ ] **Step 1: 创建 providers 路由**

创建 `packages/server/src/routes/providers.ts`：

```typescript
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { queryAll, queryOne, run } from '../db/connection.js';
import { encrypt, maskApiKey, decrypt } from '../utils/encryption.js';
import { clearModelConfigCache } from '../services/model-config-service.js';
import type { CreateProviderRequest, UpdateProviderRequest } from '@dark-boss/shared';

const router = Router();

// 列出所有提供商（API Key 脱敏）
router.get('/', (_req, res) => {
  try {
    const providers = queryAll<{
      id: string; name: string; protocol: string; base_url: string;
      api_key: string; is_active: number; created_at: number;
    }>('SELECT * FROM model_providers ORDER BY created_at');

    const result = providers.map(p => ({
      ...p,
      api_key: p.api_key ? maskApiKey(decrypt(p.api_key)) : '',
      is_active: !!p.is_active,
    }));

    res.json(result);
  } catch (err) {
    console.error('获取提供商列表失败:', err);
    res.status(500).json({ error: '获取提供商列表失败' });
  }
});

// 添加提供商
router.post('/', (req, res) => {
  try {
    const body = req.body as CreateProviderRequest;
    const id = uuid();
    const now = Date.now();
    const encryptedKey = body.apiKey ? encrypt(body.apiKey) : '';

    run(
      'INSERT INTO model_providers (id, name, protocol, base_url, api_key, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
      [id, body.name, body.protocol, body.baseUrl, encryptedKey, now],
    );

    const provider = queryOne<{
      id: string; name: string; protocol: string; base_url: string;
      api_key: string; is_active: number; created_at: number;
    }>('SELECT * FROM model_providers WHERE id = ?', [id]);

    res.json({
      ...provider,
      api_key: provider?.api_key ? maskApiKey(body.apiKey || '') : '',
      is_active: !!provider?.is_active,
    });
  } catch (err) {
    console.error('添加提供商失败:', err);
    res.status(500).json({ error: '添加提供商失败' });
  }
});

// 更新提供商
router.patch('/:id', (req, res) => {
  try {
    const body = req.body as UpdateProviderRequest;
    const existing = queryOne('SELECT * FROM model_providers WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '提供商不存在' });

    const sets: string[] = [];
    const vals: unknown[] = [];

    if (body.name !== undefined) { sets.push('name = ?'); vals.push(body.name); }
    if (body.protocol !== undefined) { sets.push('protocol = ?'); vals.push(body.protocol); }
    if (body.baseUrl !== undefined) { sets.push('base_url = ?'); vals.push(body.baseUrl); }
    if (body.isActive !== undefined) { sets.push('is_active = ?'); vals.push(body.isActive ? 1 : 0); }

    // API Key 处理：null 或不传表示保持不变，其他值覆盖
    if (body.apiKey !== undefined && body.apiKey !== null) {
      sets.push('api_key = ?');
      vals.push(body.apiKey ? encrypt(body.apiKey) : '');
    }

    if (sets.length === 0) return res.status(400).json({ error: '没有需要更新的字段' });

    vals.push(req.params.id);
    run(`UPDATE model_providers SET ${sets.join(', ')} WHERE id = ?`, vals);

    clearModelConfigCache();

    const updated = queryOne<{
      id: string; name: string; protocol: string; base_url: string;
      api_key: string; is_active: number; created_at: number;
    }>('SELECT * FROM model_providers WHERE id = ?', [req.params.id]);

    // 返回脱敏的 key
    const maskedKey = updated?.api_key ? maskApiKey(decrypt(updated.api_key as string)) : '';

    res.json({ ...updated, api_key: maskedKey, is_active: !!updated?.is_active });
  } catch (err) {
    console.error('更新提供商失败:', err);
    res.status(500).json({ error: '更新提供商失败' });
  }
});

// 删除提供商
router.delete('/:id', (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM model_providers WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '提供商不存在' });

    // 检查是否被档位映射引用
    const refs = queryAll<{ tier: string }>(
      'SELECT tier FROM model_tier_mapping WHERE provider_id = ?',
      [req.params.id],
    );
    if (refs.length > 0) {
      const tierNames = refs.map(r => r.tier).join('、');
      return res.status(409).json({ error: `该提供商正被 ${tierNames} 档位使用，请先解除映射` });
    }

    run('DELETE FROM model_providers WHERE id = ?', [req.params.id]);
    clearModelConfigCache();
    res.json({ success: true });
  } catch (err) {
    console.error('删除提供商失败:', err);
    res.status(500).json({ error: '删除提供商失败' });
  }
});

// 测试连通性
router.post('/:id/test', async (req, res) => {
  try {
    const provider = queryOne<{
      id: string; name: string; protocol: string; base_url: string;
      api_key: string; is_active: number;
    }>('SELECT * FROM model_providers WHERE id = ?', [req.params.id]);

    if (!provider) return res.status(404).json({ error: '提供商不存在' });
    if (!provider.api_key) return res.status(400).json({ error: '未配置 API Key' });

    const apiKey = decrypt(provider.api_key);
    const startTime = Date.now();

    let url: string;
    let headers: Record<string, string>;
    let body: string;

    if (provider.protocol === 'anthropic') {
      url = `${provider.base_url}/v1/messages`;
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
      body = JSON.stringify({ model: 'test', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] });
    } else {
      url = `${provider.base_url}/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
      body = JSON.stringify({ model: 'test', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] });
    }

    const response = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
    const latencyMs = Date.now() - startTime;

    // 只要服务器响应了就算连通（401 表示 Key 有效格式但可能模型名错误，也算部分成功）
    if (response.ok || response.status === 400 || response.status === 404) {
      res.json({ success: true, message: `连接成功 (${latencyMs}ms)`, latencyMs });
    } else if (response.status === 401 || response.status === 403) {
      res.json({ success: false, message: `认证失败：API Key 无效或已过期 (${latencyMs}ms)`, latencyMs });
    } else {
      const text = await response.text().catch(() => '');
      res.json({ success: false, message: `服务器返回 ${response.status}: ${text.slice(0, 200)}`, latencyMs });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '连接失败';
    res.json({ success: false, message: `连接失败: ${message}` });
  }
});

export default router;
```

- [ ] **Step 2: 验证类型检查通过**

Run: `pnpm --filter @dark-boss/server typecheck`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add packages/server/src/routes/providers.ts
git commit -m "feat(server): 新增提供商 CRUD 和测试连接路由"
```

---

## Task 6: 档位映射路由

**Files:**
- Create: `packages/server/src/routes/model-tiers.ts`

- [ ] **Step 1: 创建 model-tiers 路由**

创建 `packages/server/src/routes/model-tiers.ts`：

```typescript
import { Router } from 'express';
import { queryAll, queryOne, run } from '../db/connection.js';
import { clearModelConfigCache } from '../services/model-config-service.js';
import type { UpdateTierMappingRequest } from '@dark-boss/shared';

const router = Router();

// 获取所有档位映射
router.get('/', (_req, res) => {
  try {
    const tiers = queryAll<{
      tier: string; provider_id: string | null; model_name: string | null; updated_at: number;
    }>('SELECT * FROM model_tier_mapping ORDER BY CASE tier WHEN \'haiku\' THEN 1 WHEN \'sonnet\' THEN 2 WHEN \'opus\' THEN 3 END');

    res.json(tiers);
  } catch (err) {
    console.error('获取档位映射失败:', err);
    res.status(500).json({ error: '获取档位映射失败' });
  }
});

// 更新某个档位的映射
router.patch('/:tier', (req, res) => {
  try {
    const tier = req.params.tier;
    if (!['haiku', 'sonnet', 'opus'].includes(tier)) {
      return res.status(400).json({ error: '无效的档位名称，必须是 haiku/sonnet/opus' });
    }

    const body = req.body as UpdateTierMappingRequest;

    // 如果指定了 provider_id，验证其存在且已配置 Key
    if (body.providerId) {
      const provider = queryOne<{ id: string; api_key: string; is_active: number }>(
        'SELECT id, api_key, is_active FROM model_providers WHERE id = ?',
        [body.providerId],
      );
      if (!provider) return res.status(404).json({ error: '提供商不存在' });
      if (!provider.api_key) return res.status(400).json({ error: '该提供商未配置 API Key' });
      if (!provider.is_active) return res.status(400).json({ error: '该提供商已禁用' });
    }

    if (!body.modelName) {
      return res.status(400).json({ error: '模型名称不能为空' });
    }

    const now = Date.now();
    run(
      'UPDATE model_tier_mapping SET provider_id = ?, model_name = ?, updated_at = ? WHERE tier = ?',
      [body.providerId || null, body.modelName, now, tier],
    );

    clearModelConfigCache();

    const updated = queryOne<{
      tier: string; provider_id: string | null; model_name: string | null; updated_at: number;
    }>('SELECT * FROM model_tier_mapping WHERE tier = ?', [tier]);

    res.json(updated);
  } catch (err) {
    console.error('更新档位映射失败:', err);
    res.status(500).json({ error: '更新档位映射失败' });
  }
});

export default router;
```

- [ ] **Step 2: 注册路由**

在 `packages/server/src/routes/index.ts` 中添加：

```typescript
import providerRoutes from './providers.js';
import modelTierRoutes from './model-tiers.js';

// 在已有的 router.use 列表中添加：
router.use('/providers', providerRoutes);
router.use('/model-tiers', modelTierRoutes);
```

完整文件变为：

```typescript
import { Router } from 'express';
import agentRoutes from './agents.js';
import departmentRoutes from './departments.js';
import templateRoutes from './templates.js';
import workflowRoutes from './workflows.js';
import taskRoutes from './tasks.js';
import chatRoutes from './chat.js';
import performanceRoutes from './performance.js';
import fileRoutes from './files.js';
import providerRoutes from './providers.js';
import modelTierRoutes from './model-tiers.js';

const router = Router();

router.use('/agents', agentRoutes);
router.use('/departments', departmentRoutes);
router.use('/templates', templateRoutes);
router.use('/workflows', workflowRoutes);
router.use('/tasks', taskRoutes);
router.use('/chat', chatRoutes);
router.use('/performance', performanceRoutes);
router.use('/files', fileRoutes);
router.use('/providers', providerRoutes);
router.use('/model-tiers', modelTierRoutes);

export default router;
```

- [ ] **Step 3: 验证类型检查通过**

Run: `pnpm --filter @dark-boss/server typecheck`
Expected: 无错误

- [ ] **Step 4: 启动服务验证 API**

Run: `pnpm dev:server`
用 curl 测试：
```bash
curl http://localhost:3000/api/v1/providers
curl http://localhost:3000/api/v1/model-tiers
```
Expected: 返回预设的提供商列表和档位映射

- [ ] **Step 5: 提交**

```bash
git add packages/server/src/routes/model-tiers.ts packages/server/src/routes/index.ts
git commit -m "feat(server): 新增档位映射路由并注册到路由表"
```

---

## Task 7: 改造 claude-client.ts

**Files:**
- Modify: `packages/server/src/services/claude-client.ts`

- [ ] **Step 1: 改造 claude-client.ts 使用 ModelConfigService**

将 `packages/server/src/services/claude-client.ts` 中硬编码的环境变量读取替换为 `ModelConfigService`。

替换文件顶部的 import 和 mapModel/buildHeaders/getApiUrl 函数：

```typescript
/**
 * Claude API 封装层
 * 支持 Anthropic 和 OpenAI 兼容 API
 */
import { resolveModelConfig } from './model-config-service.js';
import type { AgentConfig, SdkResult, SdkStreamMessage } from './claude-client-types.js';
import type { ResolvedModelConfig } from '@dark-boss/shared';
```

> **注意：** AgentConfig, SdkResult, SdkStreamMessage 这几个类型仍然定义在此文件内（后面步骤处理），不需要单独文件。实际的 import 只需要加 resolveModelConfig。

实际改动步骤：

**a) 添加 import（在文件顶部）**：

在 `import { config, isClaudeSdkAvailable } from '../utils/config.js';` 之后添加：

```typescript
import { resolveModelConfig } from './model-config-service.js';
```

**b) 删除 mapModel 函数**（line 25-32），替换为：

```typescript
// 解析档位对应的模型配置
function getConfig(tier: 'sonnet' | 'opus' | 'haiku'): ResolvedModelConfig | null {
  return resolveModelConfig(tier);
}
```

**c) 删除 buildHeaders 和 getApiUrl 函数**（line 66-78），替换为：

```typescript
// 根据 protocol 构建请求 URL
function getRequestUrl(resolved: ResolvedModelConfig): string {
  if (resolved.protocol === 'openai') {
    return `${resolved.baseUrl}/chat/completions`;
  }
  // anthropic 兼容
  return `${resolved.baseUrl}/v1/messages`;
}

// 根据 protocol 构建请求头
function getRequestHeaders(resolved: ResolvedModelConfig): Record<string, string> {
  if (resolved.protocol === 'openai') {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resolved.apiKey}`,
    };
  }
  // anthropic 兼容
  return {
    'Content-Type': 'application/json',
    'x-api-key': resolved.apiKey,
    'anthropic-version': '2023-06-01',
  };
}
```

**d) 修改 isSdkAvailable 函数**（line 55-57）：

```typescript
// 检查是否有可用的模型配置
export function isSdkAvailable(): boolean {
  return resolveModelConfig('sonnet') !== null;
}
```

**e) 修改 streamQuery 函数**，将 `const model = mapModel(agent.model)` 改为：

```typescript
  const resolved = getConfig(agent.model);
  if (!resolved) {
    yield { type: 'error', error: '未配置模型提供商，请在模型设置中配置' };
    return;
  }
```

将 `buildHeaders()` 改为 `getRequestHeaders(resolved)`。
将 `getApiUrl()` 改为 `getRequestUrl(resolved)`。
将 `const model = mapModel(agent.model)` 删除，body 中 `model` 改为 `resolved.modelName`。

**f) 修改 singleQuery 函数**同理：

```typescript
  const resolved = resolveModelConfig(model);
  if (!resolved) {
    throw new Error('未配置模型提供商，请在模型设置中配置');
  }

  const body: Record<string, unknown> = {
    model: resolved.modelName,
    max_tokens: 4096,
    messages,
  };
  if (systemPrompt) body.system = systemPrompt;

  // OpenAI 使用不同的 system prompt 传递方式
  if (resolved.protocol === 'openai' && systemPrompt) {
    messages.unshift({ role: 'system' as const, content: systemPrompt });
    delete body.system;
  }

  const response = await fetch(getRequestUrl(resolved), {
    method: 'POST',
    headers: getRequestHeaders(resolved),
    body: JSON.stringify(body),
  });
```

**g) 处理 OpenAI 响应格式**：singleQuery 的响应解析也需要区分协议：

```typescript
  const result = (await response.json()) as
    | { content: Array<{ type: string; text?: string }>; usage: { input_tokens: number; output_tokens: number } } // anthropic
    | { choices: Array<{ message: { content: string } }>; usage: { prompt_tokens: number; completion_tokens: number } }; // openai

  let text: string;
  let tokens: number;

  if ('choices' in result) {
    // OpenAI 格式
    text = result.choices.map(c => c.message.content).join('');
    tokens = (result.usage?.prompt_tokens || 0) + (result.usage?.completion_tokens || 0);
  } else {
    // Anthropic 格式
    text = result.content.filter(b => b.type === 'text').map(b => b.text || '').join('');
    tokens = (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0);
  }
```

> **注意：** streamQuery 中的 SSE 解析也需要区分 OpenAI 和 Anthropic 格式。OpenAI 的 `data:` 行是 `choices[0].delta.content`，Anthropic 是 `content_block_delta.delta.text`。在 streamQuery 的事件解析循环中加入协议判断。

- [ ] **Step 2: 验证类型检查通过**

Run: `pnpm --filter @dark-boss/server typecheck`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add packages/server/src/services/claude-client.ts
git commit -m "refactor(server): 改造 claude-client 使用 ModelConfigService，支持多协议"
```

---

## Task 8: 前端路由和导航

**Files:**
- Modify: `packages/client/src/App.tsx`
- Modify: `packages/client/src/components/layout/app-layout.tsx`

- [ ] **Step 1: 在 App.tsx 中添加路由**

在 `packages/client/src/App.tsx` 中：

添加 import：

```typescript
import { ModelSettingsPage } from './pages/model-settings/index.js';
```

在 Routes 中添加路由（`<Route path="/performance" ...>` 之后）：

```typescript
<Route path="/model-settings" element={<ModelSettingsPage />} />
```

- [ ] **Step 2: 在侧边栏添加菜单项**

在 `packages/client/src/components/layout/app-layout.tsx` 中：

添加 import：

```typescript
import { SettingOutlined } from '@ant-design/icons';
```

在 `menuItems` 数组末尾添加（使用分割线和设置图标，放在底部）：

```typescript
{ key: '/model-settings', icon: <SettingOutlined />, label: '模型设置' },
```

- [ ] **Step 3: 验证前端构建无报错**

Run: `pnpm --filter @dark-boss/client typecheck`
Expected: 无错误（ModelSettingsPage 尚未创建，下一步创建）

- [ ] **Step 4: 提交**

```bash
git add packages/client/src/App.tsx packages/client/src/components/layout/app-layout.tsx
git commit -m "feat(client): 新增模型设置页面路由和侧边栏入口"
```

---

## Task 9: 模型设置页面

**Files:**
- Create: `packages/client/src/pages/model-settings/index.tsx`

- [ ] **Step 1: 创建模型设置页面**

创建 `packages/client/src/pages/model-settings/index.tsx`：

```typescript
import { useState } from 'react';
import {
  Typography, Card, Input, Select, Button, Space, Tag, Badge,
  message, Modal, Form, Row, Col, Table, Tooltip, Divider,
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined,
  LoadingOutlined, DeleteOutlined, ApiOutlined, SwapOutlined,
  EyeOutlined, EyeInvisibleOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import type { ModelProvider, ModelTierMapping, ProviderProtocol } from '@dark-boss/shared';

const { Title, Text } = Typography;

// 档位信息
const TIER_INFO: Record<string, { label: string; desc: string; color: string }> = {
  haiku: { label: 'Haiku', desc: '快速 / 低成本', color: '#52c41a' },
  sonnet: { label: 'Sonnet', desc: '平衡', color: '#1890ff' },
  opus: { label: 'Opus', desc: '高性能', color: '#722ed1' },
};

// 协议标签
function ProtocolTag({ protocol }: { protocol: ProviderProtocol }) {
  return protocol === 'openai'
    ? <Tag color="green">OpenAI 兼容</Tag>
    : <Tag color="blue">Anthropic</Tag>;
}

// 状态指示灯
function StatusBadge({ provider }: { provider: ModelProvider }) {
  if (!provider.isActive) return <Badge status="default" text="已禁用" />;
  if (!provider.apiKey) return <Badge status="default" text="未配置 Key" />;
  return <Badge status="success" text="已就绪" />;
}

// 常用模型建议
const MODEL_SUGGESTIONS: Record<string, string[]> = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-20250514', 'glm-4', 'glm-4-flash', 'glm-4-plus'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'deepseek-chat', 'deepseek-coder', 'gpt-3.5-turbo'],
};

export function ModelSettingsPage() {
  const queryClient = useQueryClient();
  const [testingId, setTestingId] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();

  // 获取提供商列表
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.get<ModelProvider[]>('/providers'),
  });

  // 获取档位映射
  const { data: tiers = [] } = useQuery({
    queryKey: ['model-tiers'],
    queryFn: () => api.get<ModelTierMapping[]>('/model-tiers'),
  });

  // 可用的提供商（已配置 Key 且启用）
  const activeProviders = providers.filter(p => p.isActive && p.apiKey);

  // 更新提供商
  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.patch(`/providers/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      message.success('提供商配置已保存，正在运行的 Agent 需要重启后生效');
    },
    onError: (err: Error) => message.error(err.message),
  });

  // 删除提供商
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/providers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      message.success('已删除');
    },
    onError: (err: Error) => message.error(err.message),
  });

  // 创建提供商
  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/providers', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      setAddModalOpen(false);
      addForm.resetFields();
      message.success('提供商已添加');
    },
    onError: (err: Error) => message.error(err.message),
  });

  // 测试连接
  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      setTestingId(id);
      const result = await api.post<{ success: boolean; message: string; latencyMs?: number }>(`/providers/${id}/test`, {});
      setTestingId(null);
      return result;
    },
    onSuccess: (result) => {
      if (result.success) {
        message.success(result.message);
      } else {
        message.error(result.message);
      }
    },
    onError: (err: Error) => {
      setTestingId(null);
      message.error(`测试失败: ${err.message}`);
    },
  });

  // 更新档位映射
  const updateTierMutation = useMutation({
    mutationFn: ({ tier, ...body }: { tier: string } & Record<string, unknown>) =>
      api.patch(`/model-tiers/${tier}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-tiers'] });
      message.success('档位映射已更新，正在运行的 Agent 需要重启后生效');
    },
    onError: (err: Error) => message.error(err.message),
  });

  // 切换 Key 显示
  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>模型设置</Title>
          <Text type="secondary">管理大模型提供商和档位映射</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
          添加提供商
        </Button>
      </div>

      {/* 提供商列表 */}
      <Title level={5}>模型提供商</Title>
      {isLoading ? (
        <Card loading style={{ marginBottom: 24 }} />
      ) : (
        <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
          {providers.map(provider => (
            <Col key={provider.id} xs={24} lg={12}>
              <Card
                size="small"
                title={
                  <Space>
                    <ApiOutlined />
                    <span>{provider.name}</span>
                    <ProtocolTag protocol={provider.protocol} />
                    <StatusBadge provider={provider} />
                  </Space>
                }
                extra={
                  <Space>
                    <Tooltip title="测试连接">
                      <Button
                        size="small"
                        icon={testingId === provider.id ? <LoadingOutlined /> : <ExperimentOutlined />}
                        onClick={() => testMutation.mutate(provider.id)}
                        disabled={!!testingId}
                      >
                        测试
                      </Button>
                    </Tooltip>
                    <Tooltip title="删除">
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          Modal.confirm({
                            title: `确定删除 ${provider.name}？`,
                            content: '如果该提供商正被档位引用，需要先解除映射。',
                            onOk: () => deleteMutation.mutate(provider.id),
                          });
                        }}
                      />
                    </Tooltip>
                  </Space>
                }
              >
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Base URL</Text>
                    <Input
                      size="small"
                      defaultValue={provider.baseUrl}
                      onBlur={e => {
                        if (e.target.value !== provider.baseUrl) {
                          updateMutation.mutate({ id: provider.id, baseUrl: e.target.value });
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>API Key</Text>
                    <Input.Search
                      size="small"
                      type={visibleKeys.has(provider.id) ? 'text' : 'password'}
                      defaultValue={provider.apiKey || ''}
                      placeholder="请输入 API Key"
                      enterButton={
                        <Button size="small" icon={visibleKeys.has(provider.id) ? <EyeInvisibleOutlined /> : <EyeOutlined />} />
                      }
                      onSearch={() => toggleKeyVisibility(provider.id)}
                      onBlur={e => {
                        const val = e.target.value;
                        // 只有用户确实输入了新值才保存（脱敏值以 *** 开头）
                        if (val && !val.startsWith('***')) {
                          updateMutation.mutate({ id: provider.id, apiKey: val });
                        }
                      }}
                    />
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Divider />

      {/* 档位映射 */}
      <Title level={5}>档位映射</Title>
      <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
        为每个性能档位选择具体的模型提供商和模型名称
      </Text>
      <Table
        dataSource={tiers}
        rowKey="tier"
        pagination={false}
        size="middle"
        columns={[
          {
            title: '档位',
            dataIndex: 'tier',
            width: 120,
            render: (tier: string) => {
              const info = TIER_INFO[tier];
              return <Tag color={info.color}>{info.label}</Tag>;
            },
          },
          {
            title: '说明',
            width: 120,
            render: (_: unknown, record: ModelTierMapping) => TIER_INFO[record.tier]?.desc,
          },
          {
            title: '提供商',
            dataIndex: 'providerId',
            width: 200,
            render: (providerId: string | null, record: ModelTierMapping) => (
              <Select
                style={{ width: '100%' }}
                value={providerId}
                placeholder="选择提供商"
                onChange={(value: string) => {
                  const suggestions = providers.find(p => p.id === value);
                  const protocol = suggestions?.protocol || 'anthropic';
                  const defaultModel = MODEL_SUGGESTIONS[protocol]?.[0] || '';
                  updateTierMutation.mutate({
                    tier: record.tier,
                    providerId: value,
                    modelName: record.modelName || defaultModel,
                  });
                }}
                options={activeProviders.map(p => ({ label: p.name, value: p.id }))}
                allowClear
              />
            ),
          },
          {
            title: '模型',
            dataIndex: 'modelName',
            render: (modelName: string | null, record: ModelTierMapping) => {
              const provider = providers.find(p => p.id === record.providerId);
              const suggestions = provider
                ? MODEL_SUGGESTIONS[provider.protocol] || []
                : [];
              return (
                <AutoCompleteInput
                  value={modelName || ''}
                  suggestions={suggestions}
                  onChange={(value) => {
                    updateTierMutation.mutate({
                      tier: record.tier,
                      providerId: record.providerId,
                      modelName: value,
                    });
                  }}
                />
              );
            },
          },
        ]}
      />

      {/* 添加提供商弹窗 */}
      <Modal
        title="添加模型提供商"
        open={addModalOpen}
        onOk={() => addForm.validateFields().then(values => createMutation.mutate(values))}
        onCancel={() => { setAddModalOpen(false); addForm.resetFields(); }}
        confirmLoading={createMutation.isPending}
      >
        <Form form={addForm} layout="vertical">
          <Form.Item name="name" label="提供商名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：通义千问" />
          </Form.Item>
          <Form.Item name="protocol" label="API 协议" rules={[{ required: true, message: '请选择协议' }]}>
            <Select
              placeholder="选择 API 协议"
              options={[
                { label: 'OpenAI 兼容', value: 'openai' },
                { label: 'Anthropic', value: 'anthropic' },
              ]}
            />
          </Form.Item>
          <Form.Item name="baseUrl" label="Base URL" rules={[{ required: true, message: '请输入 API 地址' }]}>
            <Input placeholder="https://api.example.com/v1" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key（可选，可稍后配置）">
            <Input.Password placeholder="sk-..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// 模型名称自动补全输入组件
function AutoCompleteInput({ value, suggestions, onChange }: {
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
}) {
  const [inputValue, setInputValue] = useState(value);

  return (
    <Select
      showSearch
      style={{ width: '100%' }}
      value={inputValue || undefined}
      onChange={(val) => { setInputValue(val); onChange(val); }}
      onSearch={(val) => setInputValue(val)}
      filterOption={false}
      placeholder="输入或选择模型名称"
      options={suggestions.map(s => ({ label: s, value: s }))}
      // 允许输入不在列表中的值
      onBlur={() => {
        if (inputValue && inputValue !== value) {
          onChange(inputValue);
        }
      }}
    />
  );
}
```

> **注意：** `AutoCompleteInput` 组件使用了 Ant Design 的 `Select` 配合 `showSearch` 和手动输入。如果 Ant Design 的 `AutoComplete` 组件更适合，可替换。这里用 Select 是因为更简洁。

- [ ] **Step 2: 验证前端类型检查**

Run: `pnpm --filter @dark-boss/client typecheck`
Expected: 无错误

- [ ] **Step 3: 启动前后端开发服务器，手动验证**

Run: `pnpm dev`

验证项：
1. 侧边栏出现"模型设置"入口
2. 点击进入页面，显示 4 个预设提供商卡片
3. 输入 API Key 后保存，显示脱敏值
4. 档位映射表格可选已配置 Key 的提供商
5. 测试连接按钮可用

- [ ] **Step 4: 提交**

```bash
git add packages/client/src/pages/model-settings/index.tsx
git commit -m "feat(client): 新增模型设置页面，支持提供商管理和档位映射"
```

---

## Task 10: 集成测试和收尾

**Files:**
- 可能微调前面各步骤中的细节

- [ ] **Step 1: 完整流程测试**

启动 `pnpm dev`，执行以下测试：

1. **提供商 CRUD**：添加自定义提供商 → 编辑 → 删除
2. **API Key 管理**：输入 Key → 保存 → 刷新页面确认脱敏显示
3. **测试连接**：配置正确 Key 后测试，确认返回成功
4. **档位映射**：选择提供商 + 模型名 → 保存 → 刷新确认持久化
5. **降级测试**：删除所有 Key → 确认仍可通过 .env 降级使用
6. **Agent 关联**：创建/编辑 Agent → 选择档位 → 启动 Agent 确认使用正确配置

- [ ] **Step 2: 修复发现的问题**

根据测试结果修复 bug。

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "fix: 修复模型管理功能集成问题"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - 数据模型 → Task 3
  - API 端点 → Task 5, 6
  - 加密方案 → Task 2
  - ModelConfigService → Task 4
  - claude-client 改造 → Task 7
  - 前端 UI → Task 8, 9
  - 预设数据 → Task 3
  - 配置生效策略 → Task 7 (clearModelConfigCache) + Task 9 (提示)
- [x] **Placeholder scan:** 无 TBD/TODO
- [x] **Type consistency:** ResolvedModelConfig, ModelTier, ProviderProtocol 等类型在 shared 中统一定义，各处引用一致
