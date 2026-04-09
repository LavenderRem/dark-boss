// 环境配置
export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || 'localhost',
  clientPort: parseInt(process.env.CLIENT_PORT || '5173', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dataDir: process.env.DATA_DIR || '~/.dark-boss',
};
