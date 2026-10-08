import { processJob } from '../src/worker';
import { redis } from '../src/redis';
import { jobsProcessed, jobErrors, jobProcessingTime } from '../src/metrics';

jest.mock('../src/redis', () => {
  const multi = {
    hSet: jest.fn().mockReturnThis(),
    incr: jest.fn().mockReturnThis(),
    incrByFloat: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
  return {
    redis: { hGet: jest.fn(), hSet: jest.fn(), multi: jest.fn(() => multi) },
    blockingRedis: { brPop: jest.fn() },
  };
});

jest.mock('../src/metrics', () => ({
  jobsProcessed: { inc: jest.fn() },
  jobErrors: { inc: jest.fn() },
  jobProcessingTime: { observe: jest.fn() },
}));

jest.mock('../src/tasks', () => ({
  TASKS: { sort: jest.fn().mockResolvedValue('sorted 10 integers') },
}));

const mockRedis = redis as unknown as { hGet: jest.Mock; hSet: jest.Mock; multi: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('processJob', () => {
  it('marks a job completed and records metrics', async () => {
    mockRedis.hGet.mockResolvedValueOnce('sort');

    await processJob('job-1');

    const multi = mockRedis.multi();
    expect(mockRedis.hSet).toHaveBeenCalledWith('job:job-1', expect.objectContaining({ status: 'processing' }));
    expect(multi.hSet).toHaveBeenCalledWith('job:job-1', expect.objectContaining({ status: 'completed', result: 'sorted 10 integers' }));
    expect(multi.incr).toHaveBeenCalledWith('stats:completed');
    expect(jobsProcessed.inc).toHaveBeenCalledWith({ task_type: 'sort' });
    expect(jobProcessingTime.observe).toHaveBeenCalled();
  });

  it('marks a job failed when the task type is unknown', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRedis.hGet.mockResolvedValueOnce('unknown');

    await processJob('job-2');

    const multi = mockRedis.multi();
    expect(multi.hSet).toHaveBeenCalledWith('job:job-2', expect.objectContaining({ status: 'failed' }));
    expect(multi.incr).toHaveBeenCalledWith('stats:failed');
    expect(jobErrors.inc).toHaveBeenCalledWith({ task_type: 'unknown' });
    expect(jobsProcessed.inc).not.toHaveBeenCalled();
  });

  it('skips a job that has no record', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockRedis.hGet.mockResolvedValueOnce(null);

    await processJob('job-3');

    expect(mockRedis.hSet).not.toHaveBeenCalled();
    expect(mockRedis.multi).not.toHaveBeenCalled();
  });
});