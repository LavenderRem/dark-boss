// 加载 .env 文件（必须在其他模块之前）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
  console.log('[DarkBoss] 已加载 .env 配置');
}

// 动态导入（在 .env 加载之后执行，确保 config.ts 能读到环境变量）
const http = await import('node:http');
const { createApp } = await import('./app.js');
const { initDatabase, save, closeDatabase } = await import('./db/connection.js');
const { seed } = await import('./db/seed.js');
const { createWsServer, closeWsServer } = await import('./ws/connection.js');
const { config, isClaudeSdkAvailable, getClaudeEnv } = await import('./utils/config.js');
const { snapshotAll } = await import('./services/performance-service.js');
const { restoreProcesses, shutdownAll } = await import('./services/agent-process-manager.js');

async function main() {
  // 初始化数据库
  await initDatabase();

  // 初始化种子数据
  seed();

  // 定期保存（sql.js 是内存数据库，需要持久化到文件）
  const saveInterval = setInterval(save, 30000);

  // 每小时计算绩效快照
  snapshotAll(); // 启动时立即计算一次
  const snapshotInterval = setInterval(snapshotAll, 60 * 60 * 1000);

  // 恢复 Agent 进程状态
  restoreProcesses();

  // 创建 Express 应用
  const app = createApp();

  // 创建 HTTP 服务器（同时服务 Express + WebSocket）
  const server = http.createServer(app);

  // 启动 WebSocket 服务器
  createWsServer(server);

  // 优雅退出处理
  let isShuttingDown = false;
  async function gracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n[DarkBoss] 收到 ${signal}，正在优雅退出...`);

    // 停止定时器
    clearInterval(saveInterval);
    clearInterval(snapshotInterval);

    try {
      // 1. 停止所有 Agent 子进程
      shutdownAll();

      // 2. 关闭 WebSocket 服务器
      await closeWsServer();

      // 3. 关闭 HTTP 服务器（带超时保护）
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.log('[DarkBoss] HTTP 服务器关闭超时，强制退出');
          resolve();
        }, 3000);

        server.close(() => {
          clearTimeout(timeout);
          console.log('[DarkBoss] HTTP 服务器已关闭');
          resolve();
        });
      });

      // 4. 持久化并关闭数据库
      closeDatabase();
    } catch (err) {
      console.error('[DarkBoss] 退出时出错:', err);
    }

    console.log('[DarkBoss] 退出完成');
    process.exit(0);
  }

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Windows 下 Ctrl+C 可能不触发 SIGINT，补充处理
  process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

  server.listen(config.port, config.host, () => {
    console.log(`[DarkBoss] 服务器已启动: http://${config.host}:${config.port}`);
    console.log(`[DarkBoss] WebSocket: ws://${config.host}:${config.port}/ws`);
    if (!isClaudeSdkAvailable()) {
      console.warn('[DarkBoss] ⚠️  ANTHROPIC_AUTH_TOKEN 未配置，AI 功能（绩效报告、Agent 聊天）将降级为模板模式');
    } else {
      const env = getClaudeEnv();
      console.log(`[DarkBoss] ✅ Claude Code SDK 已就绪 (${env.ANTHROPIC_BASE_URL || '默认 API'})`);
    }
  });
}

main().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
