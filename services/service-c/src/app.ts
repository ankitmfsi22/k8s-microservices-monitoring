import express, { Request, Response } from 'express';
import { redis } from './redis';
import { getStats } from './stats';
import { register, refreshMetrics } from './metrics';

export function createApp(): express.Express {
  const app = express();

  app.get('/stats', async (_req: Request, res: Response) => {
    try {
      res.json(await getStats());
    } catch (err) {
      console.error('[stats] failed:', (err as Error).message);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  app.get('/metrics', async (_req: Request, res: Response) => {
    try {
      await refreshMetrics();
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (err) {
      console.error('[metrics] failed:', (err as Error).message);
      res.status(500).send('Failed to collect metrics');
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