import { createApp } from './app.js';
import { initDatabase, save } from './db/connection.js';
import { seed } from './db/seed.js';
import { config } from './utils/config.js';

async function main() {
  // 初始化数据库
  await initDatabase();

  // 初始化种子数据
  seed();

  // 定期保存（sql.js 是内存数据库，需要持久化到文件）
  setInterval(save, 30000);

  // 启动服务器
  const app = createApp();
  app.listen(config.port, config.host, () => {
    console.log(`[暗黑老板] 服务器已启动: http://${config.host}:${config.port}`);
    console.log(`[暗黑老板] API: http://${config.host}:${config.port}/api/health`);
  });
}

main().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
