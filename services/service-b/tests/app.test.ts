import request from 'supertest';
import { createApp } from '../src/app';
import { redis } from '../src/redis';

jest.mock('../src/redis', () => ({
  redis: { ping: jest.fn() },
  blockingRedis: {},
}));

const mockRedis = redis as unknown as { ping: jest.Mock };
const app = createApp();

describe('Service B endpoints', () => {
  it('GET /metrics exposes the job metrics', async () => {
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.text).toContain('jobs_processed_total');
    expect(res.text).toContain('job_processing_time_seconds');
    expect(res.text).toContain('job_errors_total');
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('GET /ready returns 503 when Redis is down', async () => {
    mockRedis.ping.mockRejectedValueOnce(new Error('Redis down'));
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
  });
});