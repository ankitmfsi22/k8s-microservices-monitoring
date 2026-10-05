import express from 'express';
import { config } from './config.js';
import { redis, connectRedis } from './redis.js';
import { getStats } from './stats.js';
import { register, refreshMetrics } from './metrics.js';

const app = express();

app.get('/stats', async (req, res) => {
  try {
    res.json(await getStats());
  } catch (err) {
    console.error('[stats] failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/metrics', async (req, res) => {
  try {
    await refreshMetrics();
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    console.error('[metrics] failed:', err.message);
    res.status(500).send('Failed to collect metrics');
  }
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
    console.log(`[service-c] listening on port ${config.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`[service-c] ${signal} received, shutting down`);
    server.close();
    await redis.quit();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('[service-c] failed to start:', err.message);
  process.exit(1);
});