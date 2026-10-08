export const config = {
  port: Number(process.env.PORT) || 3001,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  pollTimeoutSeconds: Number(process.env.POLL_TIMEOUT_SECONDS) || 5,
};

export const KEYS = {
  queue: 'jobs:queue',
  job: (id: string) => `job:${id}`,
  completed: 'stats:completed',
  failed: 'stats:failed',
  totalProcessingTime: 'stats:total_processing_time',
};