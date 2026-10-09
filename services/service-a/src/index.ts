import { config } from './config';
import { createApp } from './app';
import { redis, connectRedis } from './redis';

async function start(): Promise<void> {
  await connectRedis();

  const server = createApp().listen(config.port, () => {
    console.log(`[service-a] listening on port ${config.port}`);
  });

  // Graceful shutdown (Kubernetes sends SIGTERM before killing a pod)
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[service-a] ${signal} received, shutting down`);
    server.close();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((err: Error) => {
  console.error('[service-a] failed to start:', err.message);
  process.exit(1);
});
