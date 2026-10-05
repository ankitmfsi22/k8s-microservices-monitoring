import { KEYS } from './config.js';
import { redis } from './redis.js';

export async function getStats() {
  const [counters, queueLength] = await redis
    .multi()
    .mGet([KEYS.submitted, KEYS.completed, KEYS.failed, KEYS.totalProcessingTime])
    .lLen(KEYS.queue)
    .exec();

  const [submitted, completed, failed, totalTime] = counters.map((v) => Number(v) || 0);

  return {
    totalJobsSubmitted: submitted,
    totalJobsCompleted: completed,
    totalJobsFailed: failed,
    queueLength: Number(queueLength),
    avgProcessingTimeSeconds: completed > 0 ? Number((totalTime / completed).toFixed(4)) : 0,
  };
}