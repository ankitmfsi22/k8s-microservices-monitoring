import express from 'express';
import { config } from './config.js';
import { redis, blockingRedis, connectRedis } from './redis.js';
import { register } from './metrics.js';
import { runWorker, stopWorker } from './worker.js';

const app = express();
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/ready', async (req, res) => {
  try {
    await redis.ping();
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});

async function start() {
  await connectRedis();

  const server = app.listen(config.port, () => {
    console.log(`[service-b] metrics server on port ${config.port}`);
  });

  const workerDone = runWorker();
  const shutdown = async (signal) => {
    console.log(`[service-b] ${signal} received, finishing current job`);
    stopWorker();
    await workerDone;
    server.close();
    await Promise.all([redis.quit(), blockingRedis.quit()]);
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('[service-b] failed to start:', err.message);
  process.exit(1);
});