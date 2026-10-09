import { calculatePrimes, bcryptHash, generateAndSort, TASKS } from '../src/tasks';

describe('CPU tasks', () => {
  it('counts primes correctly for a small limit', () => {
    expect(calculatePrimes(100)).toBe('found 25 primes up to 100');
  });

  it('counts primes up to 100,000', () => {
    expect(calculatePrimes()).toBe('found 9592 primes up to 100000');
  });

  it('sorts the generated array', () => {
    expect(generateAndSort(1000)).toMatch(/^sorted 1000 integers \(min=\d+, max=\d+\)$/);
  });

  it('generates a bcrypt hash', async () => {
    await expect(bcryptHash()).resolves.toMatch(/^bcrypt hash generated \(\$2[aby]\$10\$/);
  });

  it('exposes all three task types', () => {
    expect(Object.keys(TASKS).sort()).toEqual(['bcrypt', 'primes', 'sort']);
  });
});
