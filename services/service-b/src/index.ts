import { config } from './config';
import { createApp } from './app';
import { redis, blockingRedis, connectRedis } from './redis';
import { runWorker, stopWorker } from './worker';

async function start(): Promise<void> {
  await connectRedis();

  const server = createApp().listen(config.port, () => {
    console.log(`[service-b] metrics server on port ${config.port}`);
  });

  const workerDone = runWorker();
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[service-b] ${signal} received, finishing current job`);
    stopWorker();
    await workerDone;
    server.close();
    await Promise.all([redis.quit(), blockingRedis.quit()]);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((err: Error) => {
  console.error('[service-b] failed to start:', err.message);
  process.exit(1);
});
