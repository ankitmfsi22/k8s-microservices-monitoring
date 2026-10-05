import { createClient } from 'redis';
import { config } from './config.js';

export const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => console.error('[redis] error:', err.message));

export async function connectRedis() {
  await redis.connect();
  console.log(`[redis] connected to ${config.redisUrl}`);
}