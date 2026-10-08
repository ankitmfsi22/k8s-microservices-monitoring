import request from 'supertest';
import { createApp } from '../src/app';
import { redis } from '../src/redis';

jest.mock('../src/redis', () => {
  const multi = {
    hSet: jest.fn().mockReturnThis(),
    lPush: jest.fn().mockReturnThis(),
    incr: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
  return {
    redis: { multi: jest.fn(() => multi), hGetAll: jest.fn(), ping: jest.fn() },
    connectRedis: jest.fn(),
  };
});

const mockRedis = redis as unknown as {
  multi: jest.Mock;
  hGetAll: jest.Mock;
  ping: jest.Mock;
};

const app = createApp();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /submit', () => {
  it('queues a job with the given task type', async () => {
    const res = await request(app).post('/submit').send({ taskType: 'primes' });
    expect(res.status).toBe(202);
    expect(res.body.taskType).toBe('primes');
    expect(res.body.status).toBe('queued');
    expect(typeof res.body.jobId).toBe('string');
    expect(mockRedis.multi).toHaveBeenCalledTimes(1);
  });

  it('picks a random task type when none is given', async () => {
    const res = await request(app).post('/submit').send({});

    expect(res.status).toBe(202);
    expect(['primes', 'bcrypt', 'sort']).toContain(res.body.taskType);
  });

  it('rejects an invalid task type', async () => {
    const res = await request(app).post('/submit').send({ taskType: 'abc' });
    expect(res.status).toBe(400);
    expect(mockRedis.multi).not.toHaveBeenCalled();
  });

  it('returns 500 when Redis fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRedis.multi().exec.mockRejectedValueOnce(new Error('Redis down'));
    const res = await request(app).post('/submit').send({ taskType: 'sort' });
    expect(res.status).toBe(500);
  });
});

describe('GET /status/:id', () => {
  it('returns the job when it exists', async () => {
    mockRedis.hGetAll.mockResolvedValueOnce({ id: 'abc', status: 'completed' });
    const res = await request(app).get('/status/abc');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  it('returns 404 when the job does not exist', async () => {
    mockRedis.hGetAll.mockResolvedValueOnce({});
    const res = await request(app).get('/status/missing');
    expect(res.status).toBe(404);
  });
});

describe('health checks', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
  it('GET /ready returns 200 when Redis responds', async () => {
    mockRedis.ping.mockResolvedValueOnce('PONG');
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
  });
  it('GET /ready returns 503 when Redis is down', async () => {
    mockRedis.ping.mockRejectedValueOnce(new Error('Redis down'));
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
  });
});