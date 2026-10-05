import { createClient } from 'redis';
import { config } from './config.js';

export const redis = createClient({ url: config.redisUrl });
export const blockingRedis = redis.duplicate();

redis.on('error', (err) => console.error('[redis] error:', err.message));
blockingRedis.on('error', (err) => console.error('[redis-blocking] error:', err.message));

export async function connectRedis() {
  await Promise.all([redis.connect(), blockingRedis.connect()]);
  console.log(`[redis] connected to ${config.redisUrl}`);
}