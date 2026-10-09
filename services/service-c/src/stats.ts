import { KEYS } from './config';
import { redis } from './redis';

export interface Stats {
  totalJobsSubmitted: number;
  totalJobsCompleted: number;
  totalJobsFailed: number;
  queueLength: number;
  avgProcessingTimeSeconds: number;
}

export async function getStats(): Promise<Stats> {
  const [counters, queueLength] = (await redis
    .multi()
    .mGet([KEYS.submitted, KEYS.completed, KEYS.failed, KEYS.totalProcessingTime])
    .lLen(KEYS.queue)
    .exec()) as [(string | null)[], number];

  const [submitted, completed, failed, totalTime] = counters.map((v) => Number(v) || 0);

  return {
    totalJobsSubmitted: submitted,
    totalJobsCompleted: completed,
    totalJobsFailed: failed,
    queueLength: Number(queueLength),
    avgProcessingTimeSeconds: completed > 0 ? Number((totalTime / completed).toFixed(4)) : 0,
  };
}
