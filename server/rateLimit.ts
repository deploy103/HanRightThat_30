/**
 * 로그인 brute-force 방어용 in-memory rate limiter.
 * 단일 프로세스 기준이며 재시작 시 초기화된다 (Redis 등 외부 저장소 없이 이번 축제 규모에 맞춘 최소 구현).
 */

interface Bucket {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

const buckets = new Map<string, Bucket>();

export function checkLoginAllowed(key: string): { allowed: boolean; retryAfterSec?: number } {
  const bucket = buckets.get(key);
  if (!bucket) return { allowed: true };

  const now = Date.now();
  if (bucket.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.lockedUntil - now) / 1000) };
  }
  if (now - bucket.firstFailureAt > WINDOW_MS) {
    buckets.delete(key);
  }
  return { allowed: true };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.firstFailureAt > WINDOW_MS) {
    buckets.set(key, { failures: 1, firstFailureAt: now, lockedUntil: 0 });
    return;
  }
  bucket.failures += 1;
  if (bucket.failures >= MAX_FAILURES) {
    bucket.lockedUntil = now + LOCK_MS;
  }
}

export function recordLoginSuccess(key: string): void {
  buckets.delete(key);
}
