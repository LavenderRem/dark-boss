import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import apiRoutes from './routes/index.js';
import { config, isProduction } from './utils/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // CORS 中间件
  app.use((req, res, next) => {
    if (isProduction) {
      const origin = req.headers.origin || req.headers.referer;
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin.replace(/\/$/, ''));
      }
    } else {
      res.header('Access-Control-Allow-Origin', `http://localhost:${config.clientPort}`);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json());

  // 生产环境：先注册静态文件托管（在 API 路由之前）
  if (isProduction) {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
  }

  // API 路由
  app.use('/api/v1', apiRoutes);

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
  });

  // 生产环境：SPA 回退（必须放在所有路由之后、错误处理之前）
  if (isProduction) {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    app.use((req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
        return next();
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // 错误处理
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(`[错误] ${req.method} ${req.path}:`, err.message);
    res.status(500).json({ error: '服务器内部错误' });
  });

  return app;
}
