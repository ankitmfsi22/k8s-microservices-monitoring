import type { Request, Response } from 'express';
import express from 'express';
import { randomUUID } from 'node:crypto';
import type { TaskType } from './config';
import { KEYS, TASK_TYPES, isTaskType } from './config';
import { redis } from './redis';

function pickRandomTask(): TaskType {
  return TASK_TYPES[Math.floor(Math.random() * TASK_TYPES.length)];
}

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.post('/submit', async (req: Request, res: Response) => {
    const { taskType: requested } = (req.body ?? {}) as { taskType?: unknown };
    let taskType: TaskType;
    if (requested === undefined) {
      taskType = pickRandomTask();
    } else if (isTaskType(requested)) {
      taskType = requested;
    } else {
      res.status(400).json({ error: `Invalid taskType. Allowed: ${TASK_TYPES.join(', ')}` });
      return;
    }

    try {
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
      console.error('[submit] failed:', (err as Error).message);
      res.status(500).json({ error: 'Failed to submit job' });
    }
  });

  app.get('/status/:id', async (req: Request, res: Response) => {
    try {
      const job = await redis.hGetAll(KEYS.job(req.params.id));

      if (Object.keys(job).length === 0) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      res.json(job);
    } catch (err) {
      console.error('[status] failed:', (err as Error).message);
      res.status(500).json({ error: 'Failed to fetch job status' });
    }
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.get('/ready', async (_req: Request, res: Response) => {
    try {
      await redis.ping();
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not ready' });
    }
  });

  return app;
}
