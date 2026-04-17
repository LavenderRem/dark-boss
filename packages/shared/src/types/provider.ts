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