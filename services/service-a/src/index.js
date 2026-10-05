import express from 'express';
import { randomUUID } from 'node:crypto';
import { config, KEYS, TASK_TYPES } from './config.js';
import { redis, connectRedis } from './redis.js';

const app = express();
app.use(express.json());
app.post('/submit', async (req, res) => {
  try {
    const requested = req.body?.taskType;

    if (requested && !TASK_TYPES.includes(requested)) {
      return res.status(400).json({
        error: `Invalid taskType. Allowed: ${TASK_TYPES.join(', ')}`,
      });
    }
    const taskType =
      requested || TASK_TYPES[Math.floor(Math.random() * TASK_TYPES.length)];

    const id = randomUUID();
    const submittedAt = new Date().toISOString();

    await redis
      .multi()
      .hSet(KEYS.job(id), { id, taskType, status: 'queued', submittedAt })
      .lPush(KEYS.queue, id)
      .incr(KEYS.submitted)
      .exec();

    res.status(202).json({ jobId: id, taskType, status: 'queued' });
  } catch (err) {
    console.error('[submit] failed:', err.message);
    res.status(500).json({ error: 'Failed to submit job' });
  }
});

app.get('/status/:id', async (req, res) => {
  try {
    const job = await redis.hGetAll(KEYS.job(req.params.id));

    if (Object.keys(job).length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (err) {
    console.error('[status] failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch job status' });
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
    console.log(`[service-a] listening on port ${config.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`[service-a] ${signal} received, shutting down`);
    server.close();
    await redis.quit();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('[service-a] failed to start:', err.message);
  process.exit(1);
});