export const config = {
  port: Number(process.env.PORT) || 3002,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};

export const KEYS = {
  queue: 'jobs:queue',
  submitted: 'stats:submitted',
  completed: 'stats:completed',
  failed: 'stats:failed',
  totalProcessingTime: 'stats:total_processing_time',
};
