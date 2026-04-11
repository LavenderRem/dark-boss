import http from 'node:http';
import { createApp } from './app.js';
import { initDatabase, save } from './db/connection.js';
import { seed } from './db/seed.js';
import { createWsServer } from './ws/connection.js';
import { config } from './utils/config.js';
import { snapshotAll } from './services/performance-service.js';

async function main() {
  // 初始化数据库
  await initDatabase();

  // 初始化种子数据
  seed();

  // 定期保存（sql.js 是内存数据库，需要持久化到文件）
  setInterval(save, 30000);

  // 每小时计算绩效快照
  snapshotAll(); // 启动时立即计算一次
  setInterval(snapshotAll, 60 * 60 * 1000);

  // 创建 Express 应用
  const app = createApp();

  // 创建 HTTP 服务器（同时服务 Express + WebSocket）
  const server = http.createServer(app);

  // 启动 WebSocket 服务器
  createWsServer(server);

  server.listen(config.port, config.host, () => {
    console.log(`[暗黑老板] 服务器已启动: http://${config.host}:${config.port}`);
    console.log(`[暗黑老板] WebSocket: ws://${config.host}:${config.port}/ws`);
  });
}

main().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
