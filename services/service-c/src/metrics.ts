import client from 'prom-client';
import { getStats } from './stats';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

const submitted = new client.Gauge({
  name: 'total_jobs_submitted',
  help: 'Total number of jobs submitted',
  registers: [register],
});

const completed = new client.Gauge({
  name: 'total_jobs_completed',
  help: 'Total number of jobs completed',
  registers: [register],
});

const failed = new client.Gauge({
  name: 'total_jobs_failed',
  help: 'Total number of jobs failed',
  registers: [register],
});

const queueLength = new client.Gauge({
  name: 'queue_length',
  help: 'Current number of jobs waiting in the queue',
  registers: [register],
});

const avgTime = new client.Gauge({
  name: 'avg_job_processing_time_seconds',
  help: 'Average job processing time in seconds',
  registers: [register],
});

export async function refreshMetrics(): Promise<void> {
  const s = await getStats();
  submitted.set(s.totalJobsSubmitted);
  completed.set(s.totalJobsCompleted);
  failed.set(s.totalJobsFailed);
  queueLength.set(s.queueLength);
  avgTime.set(s.avgProcessingTimeSeconds);
}
