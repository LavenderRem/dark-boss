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
    }>("SELECT * FROM model_tier_mapping ORDER BY CASE tier WHEN 'haiku' THEN 1 WHEN 'sonnet' THEN 2 WHEN 'opus' THEN 3 END");

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