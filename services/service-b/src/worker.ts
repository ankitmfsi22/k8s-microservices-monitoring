import { config, KEYS } from './config';
import { redis, blockingRedis } from './redis';
import { TASKS } from './tasks';
import { jobsProcessed, jobErrors, jobProcessingTime } from './metrics';

let running = true;

export function stopWorker(): void {
  running = false;
}

// Process a single job: run its task, save the result, update counters and metrics
export async function processJob(id: string): Promise<void> {
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
    const message = (err as Error).message;

    await redis
      .multi()
      .hSet(jobKey, { status: 'failed', error: message, completedAt: new Date().toISOString() })
      .incr(KEYS.failed)
      .exec();

    jobErrors.inc({ task_type: taskType });
    console.error(`[worker] job ${id} failed:`, message);
  }
}

// Single long-running loop: wait for a job, process it, repeat
export async function runWorker(): Promise<void> {
  console.log('[worker] started, waiting for jobs');

  while (running) {
    try {
      const item = await blockingRedis.brPop(KEYS.queue, config.pollTimeoutSeconds);
      if (!item) continue; // timeout, no job: loop again and re-check `running`

      await processJob(item.element);
    } catch (err) {
      console.error('[worker] loop error:', (err as Error).message);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // back off briefly
    }
  }

  console.log('[worker] stopped');
}
