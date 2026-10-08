import request from 'supertest';
import { createApp } from '../src/app';
import { redis } from '../src/redis';

jest.mock('../src/redis', () => {
  const multi = {
    mGet: jest.fn().mockReturnThis(),
    lLen: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };
  return { redis: { multi: jest.fn(() => multi), ping: jest.fn() } };
});

const mockRedis = redis as unknown as { multi: jest.Mock; ping: jest.Mock };
const exec = mockRedis.multi().exec as jest.Mock;
const app = createApp();

describe('Service C endpoints', () => {
  it('GET /stats returns the stats as JSON', async () => {
    exec.mockResolvedValueOnce([['10', '8', '0', '0.4'], 2]);
    const res = await request(app).get('/stats');
    expect(res.status).toBe(200);
    expect(res.body.totalJobsSubmitted).toBe(10);
    expect(res.body.queueLength).toBe(2);
  });

  it('GET /stats returns 500 when Redis fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    exec.mockRejectedValueOnce(new Error('Redis down'));
    const res = await request(app).get('/stats');
    expect(res.status).toBe(500);
  });

  it('GET /metrics exposes the Prometheus gauges with current values', async () => {
    exec.mockResolvedValueOnce([['10', '8', '1', '0.4'], 2]);
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('total_jobs_submitted 10');
    expect(res.text).toContain('total_jobs_completed 8');
    expect(res.text).toContain('queue_length 2');
  });

  it('GET /ready returns 200 when Redis responds', async () => {
    mockRedis.ping.mockResolvedValueOnce('PONG');
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
  });
});