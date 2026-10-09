import { getStats } from '../src/stats';
import { redis } from '../src/redis';

jest.mock('../src/redis', () => {
  const multi = {
    mGet: jest.fn().mockReturnThis(),
    lLen: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };
  return { redis: { multi: jest.fn(() => multi) } };
});

const mockRedis = redis as unknown as { multi: jest.Mock };
const exec = mockRedis.multi().exec as jest.Mock;

describe('getStats', () => {
  it('returns counts, queue length and average time', async () => {
    exec.mockResolvedValueOnce([['100', '80', '2', '4.0'], 18]);
    await expect(getStats()).resolves.toEqual({
      totalJobsSubmitted: 100,
      totalJobsCompleted: 80,
      totalJobsFailed: 2,
      queueLength: 18,
      avgProcessingTimeSeconds: 0.05,
    });
  });

  it('returns zeros when no jobs exist yet', async () => {
    exec.mockResolvedValueOnce([[null, null, null, null], 0]);
    await expect(getStats()).resolves.toEqual({
      totalJobsSubmitted: 0,
      totalJobsCompleted: 0,
      totalJobsFailed: 0,
      queueLength: 0,
      avgProcessingTimeSeconds: 0,
    });
  });

  it('reads everything in a single Redis transaction', async () => {
    mockRedis.multi.mockClear();
    exec.mockResolvedValueOnce([['1', '1', '0', '0.5'], 0]);
    await getStats();
    expect(mockRedis.multi).toHaveBeenCalledTimes(1);
  });
});
