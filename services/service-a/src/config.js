export const config = {
  port: Number(process.env.PORT) || 3000,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};

export const TASK_TYPES = ['primes', 'bcrypt', 'sort'];

export const KEYS = {
  queue: 'jobs:queue',
  job: (id) => `job:${id}`,
  submitted: 'stats:submitted',
};