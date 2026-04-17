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