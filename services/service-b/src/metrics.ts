import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const jobsProcessed = new client.Counter({
  name: 'jobs_processed_total',
  help: 'Total number of jobs processed successfully',
  labelNames: ['task_type'],
  registers: [register],
});

export const jobErrors = new client.Counter({
  name: 'job_errors_total',
  help: 'Total number of jobs that failed',
  labelNames: ['task_type'],
  registers: [register],
});

export const jobProcessingTime = new client.Histogram({
  name: 'job_processing_time_seconds',
  help: 'Time taken to process a job',
  labelNames: ['task_type'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});