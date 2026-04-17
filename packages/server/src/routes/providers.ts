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
    const providers = queryAll('SELECT * FROM model_providers ORDER BY created_at DESC');
    const masked = providers.map(p => ({
      ...p,
      is_active: !!p.is_active,
      api_key: p.api_key ? maskApiKey(decrypt(p.api_key as string)) : '',
    }));
    res.json(masked);
  } catch (err) {
    console.error('获取提供商列表失败:', err);
    res.status(500).json({ error: '获取提供商列表失败' });
  }
});

// 创建提供商
router.post('/', (req, res) => {
  try {
    const body = req.body as CreateProviderRequest;
    const id = uuid();
    const now = Date.now();

    const encryptedKey = body.apiKey ? encrypt(body.apiKey) : '';

    run(
      `INSERT INTO model_providers (id, name, protocol, base_url, api_key, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, body.name, body.protocol, body.baseUrl, encryptedKey, 1, now]
    );

    const provider = queryOne('SELECT * FROM model_providers WHERE id = ?', [id]);
    clearModelConfigCache();

    res.status(201).json({
      ...provider,
      is_active: !!provider?.is_active,
      api_key: provider?.api_key ? maskApiKey(decrypt(provider.api_key as string)) : '',
    });
  } catch (err) {
    console.error('创建提供商失败:', err);
    res.status(500).json({ error: '创建提供商失败' });
  }
});

// 更新提供商（部分更新）
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

    // API Key 处理：null 或 undefined 表示保持不变，其他值表示更新
    if (body.apiKey !== undefined && body.apiKey !== null) {
      sets.push('api_key = ?');
      vals.push(encrypt(body.apiKey));
    }

    if (sets.length === 0) {
      // 无更新，直接返回现有数据
      return res.json({
        ...existing,
        is_active: !!existing.is_active,
        api_key: existing.api_key ? maskApiKey(decrypt(existing.api_key as string)) : '',
      });
    }

    vals.push(req.params.id);
    run(`UPDATE model_providers SET ${sets.join(', ')} WHERE id = ?`, vals);

    const updated = queryOne('SELECT * FROM model_providers WHERE id = ?', [req.params.id]);
    clearModelConfigCache();

    res.json({
      ...updated,
      is_active: !!updated?.is_active,
      api_key: updated?.api_key ? maskApiKey(decrypt(updated.api_key as string)) : '',
    });
  } catch (err) {
    console.error('更新提供商失败:', err);
    res.status(500).json({ error: '更新提供商失败' });
  }
});

// 删除提供商
router.delete('/:id', (req, res) => {
  try {
    const provider = queryOne('SELECT * FROM model_providers WHERE id = ?', [req.params.id]);
    if (!provider) return res.status(404).json({ error: '提供商不存在' });

    // 检查是否被档位映射引用
    const mapping = queryOne('SELECT * FROM model_tier_mapping WHERE provider_id = ?', [req.params.id]);
    if (mapping) {
      return res.status(409).json({ error: '该提供商正在被档位映射使用，无法删除' });
    }

    run('DELETE FROM model_providers WHERE id = ?', [req.params.id]);
    clearModelConfigCache();

    res.json({ success: true });
  } catch (err) {
    console.error('删除提供商失败:', err);
    res.status(500).json({ error: '删除提供商失败' });
  }
});

// 测试提供商连接
router.post('/:id/test', async (req, res) => {
  try {
    const provider = queryOne('SELECT * FROM model_providers WHERE id = ?', [req.params.id]);
    if (!provider) return res.status(404).json({ error: '提供商不存在' });

    const apiKey = decrypt(provider.api_key as string);
    if (!apiKey) return res.status(400).json({ error: '该提供商未配置 API Key' });

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      if (provider.protocol === 'anthropic') {
        // Anthropic 协议测试
        const response = await fetch(`${provider.base_url}/v1/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const latency = Date.now() - startTime;
          res.json({ success: true, message: '连接成功', latencyMs: latency });
        } else {
          res.json({
            success: false,
            message: `连接失败: HTTP ${response.status} ${response.statusText}`,
          });
        }
      } else if (provider.protocol === 'openai') {
        // OpenAI 协议测试
        const response = await fetch(`${provider.base_url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const latency = Date.now() - startTime;
          res.json({ success: true, message: '连接成功', latencyMs: latency });
        } else {
          res.json({
            success: false,
            message: `连接失败: HTTP ${response.status} ${response.statusText}`,
          });
        }
      } else {
        res.json({ success: false, message: `不支持的协议: ${provider.protocol}` });
      }
    } catch (fetchError: unknown) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        res.json({ success: false, message: '连接超时（10秒）' });
      } else {
        res.json({
          success: false,
          message: `网络错误: ${fetchError instanceof Error ? fetchError.message : '未知错误'}`,
        });
      }
    }
  } catch (err) {
    console.error('测试提供商连接失败:', err);
    res.status(500).json({ error: '测试提供商连接失败' });
  }
});

export default router;
