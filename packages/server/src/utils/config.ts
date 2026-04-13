// 环境配置
export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || 'localhost',
  clientPort: parseInt(process.env.CLIENT_PORT || '5173', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dataDir: process.env.DATA_DIR || '~/.dark-boss',

  // Claude Code CLI 配置（支持智谱等兼容 API）
  anthropicAuthToken: process.env.ANTHROPIC_AUTH_TOKEN || '',
  anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || '',
  anthropicDefaultHaikuModel: process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL || 'claude-haiku-4-20250414',
  anthropicDefaultOpusModel: process.env.ANTHROPIC_DEFAULT_OPUS_MODEL || 'claude-opus-4-20250414',
  anthropicDefaultSonnetModel: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'claude-sonnet-4-20250414',
};

// 检查 Claude SDK 是否可用
export function isClaudeSdkAvailable(): boolean {
  return !!config.anthropicAuthToken;
}

// 构建 Claude CLI 环境变量
export function getClaudeEnv(): Record<string, string> {
  const env: Record<string, string> = {};

  if (config.anthropicAuthToken) {
    env.ANTHROPIC_AUTH_TOKEN = config.anthropicAuthToken;
  }
  if (config.anthropicBaseUrl) {
    env.ANTHROPIC_BASE_URL = config.anthropicBaseUrl;
  }
  if (config.anthropicDefaultHaikuModel) {
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = config.anthropicDefaultHaikuModel;
  }
  if (config.anthropicDefaultOpusModel) {
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = config.anthropicDefaultOpusModel;
  }
  if (config.anthropicDefaultSonnetModel) {
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = config.anthropicDefaultSonnetModel;
  }

  // 传递超时配置
  env.API_TIMEOUT_MS = process.env.API_TIMEOUT_MS || '3000000';
  env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';

  return env;
}
