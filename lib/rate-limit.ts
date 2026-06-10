export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

const MAX_STORE_SIZE = 10_000;

function evict(): void {
  const now = Date.now();

  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }

  if (store.size > MAX_STORE_SIZE) {
    const entries = [...store.entries()];
    entries.sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toDelete = store.size - MAX_STORE_SIZE;
    for (let i = 0; i < toDelete && i < entries.length; i++) {
      store.delete(entries[i][0]);
    }
  }
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  evict();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export function getRateLimitStatus(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  evict();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    return { allowed: true, remaining: maxRequests, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}
