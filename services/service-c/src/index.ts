import { config } from './config';
import { createApp } from './app';
import { redis, connectRedis } from './redis';

async function start(): Promise<void> {
  await connectRedis();
  const server = createApp().listen(config.port, () => {
    console.log(`[service-c] listening on port ${config.port}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[service-c] ${signal} received, shutting down`);
    server.close();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((err: Error) => {
  console.error('[service-c] failed to start:', err.message);
  process.exit(1);
});