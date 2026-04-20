import express from 'express';
import apiRoutes from './routes/index.js';
import { config } from './utils/config.js';

export function createApp() {
  const app = express();

  // 中间件
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', `http://localhost:${config.clientPort}`);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json());

  // API 路由
  app.use('/api/v1', apiRoutes);

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
  });

  // 错误处理
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(`[错误] ${req.method} ${req.path}:`, err.message);
    res.status(500).json({ error: '服务器内部错误' });
  });

  return app;
}
