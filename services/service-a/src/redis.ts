import { createClient } from 'redis';
import { config } from './config';

export const redis = createClient({ url: config.redisUrl });

redis.on('error', (err: Error) => console.error('[redis] error:', err.message));

export async function connectRedis(): Promise<void> {
  await redis.connect();
  console.log(`[redis] connected to ${config.redisUrl}`);
}
