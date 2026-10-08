export const config = {
  port: Number(process.env.PORT) || 3000,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};

export const TASK_TYPES = ['primes', 'bcrypt', 'sort'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export function isTaskType(value: unknown): value is TaskType {
  return typeof value === 'string' && (TASK_TYPES as readonly string[]).includes(value);
}

export const KEYS = {
  queue: 'jobs:queue',
  job: (id: string) => `job:${id}`,
  submitted: 'stats:submitted',
};