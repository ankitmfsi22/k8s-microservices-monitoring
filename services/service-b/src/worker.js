import { config, KEYS } from './config.js';
import { redis, blockingRedis } from './redis.js';
import { TASKS } from './tasks.js';
import { jobsProcessed, jobErrors, jobProcessingTime } from './metrics.js';

let running = true;

export function stopWorker() {
  running = false;
}

async function processJob(id) {
  const jobKey = KEYS.job(id);
  const taskType = await redis.hGet(jobKey, 'taskType');

  if (!taskType) {
    console.warn(`[worker] job ${id} has no record, skipping`);
    return;
  }

  await redis.hSet(jobKey, { status: 'processing', startedAt: new Date().toISOString() });

  const start = process.hrtime.bigint();

  try {
    const task = TASKS[taskType];
    if (!task) throw new Error(`Unknown task type: ${taskType}`);

    const result = await task();
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;

    await redis
      .multi()
      .hSet(jobKey, {
        status: 'completed',
        result,
        durationSeconds: seconds.toFixed(4),
        completedAt: new Date().toISOString(),
      })
      .incr(KEYS.completed)
      .incrByFloat(KEYS.totalProcessingTime, seconds)
      .exec();

    jobsProcessed.inc({ task_type: taskType });
    jobProcessingTime.observe({ task_type: taskType }, seconds);
  } catch (err) {
    await redis
      .multi()
      .hSet(jobKey, { status: 'failed', error: err.message, completedAt: new Date().toISOString() })
      .incr(KEYS.failed)
      .exec();

    jobErrors.inc({ task_type: taskType });
    console.error(`[worker] job ${id} failed:`, err.message);
  }
}
export async function runWorker() {
  console.log('[worker] started, waiting for jobs');

  while (running) {
    try {
      const item = await blockingRedis.brPop(KEYS.queue, config.pollTimeoutSeconds);
      if (!item) continue;

      await processJob(item.element);
    } catch (err) {
      console.error('[worker] loop error:', err.message);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log('[worker] stopped');
}