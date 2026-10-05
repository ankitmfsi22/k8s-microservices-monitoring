import bcrypt from 'bcryptjs';

function calculatePrimes(limit = 100_000) {
  let count = 0;
  for (let n = 2; n <= limit; n++) {
    let isPrime = true;
    for (let d = 2; d * d <= n; d++) {
      if (n % d === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) count++;
  }
  return `found ${count} primes up to ${limit}`;
}
async function bcryptHash() {
  const hash = await bcrypt.hash(`job-${Date.now()}`, 10);
  return `bcrypt hash generated (${hash.slice(0, 15)}...)`;
}

function generateAndSort(size = 100_000) {
  const arr = Array.from({ length: size }, () => Math.floor(Math.random() * size));
  arr.sort((a, b) => a - b);
  return `sorted ${size} integers (min=${arr[0]}, max=${arr[size - 1]})`;
}

export const TASKS = {
  primes: calculatePrimes,
  bcrypt: bcryptHash,
  sort: generateAndSort,
};