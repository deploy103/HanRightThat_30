/**
 * 로그인/2단계 인증 brute-force 방어용 in-memory rate limiter.
 * 단일 프로세스 기준이며 재시작 시 초기화된다 (Redis 등 외부 저장소 없이 이번 축제 규모에 맞춘 최소 구현).
 */

interface Bucket {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

export interface LimiterOptions {
  /** 실패 횟수를 세는 창 */
  windowMs: number;
  /** 이 횟수를 채우면 잠근다 */
  maxFailures: number;
  /** 잠금 유지 시간 */
  lockMs: number;
}

export interface Limiter {
  check(key: string): { allowed: boolean; retryAfterSec?: number };
  fail(key: string): void;
  succeed(key: string): void;
}

export function createLimiter(options: LimiterOptions): Limiter {
  const buckets = new Map<string, Bucket>();

  return {
    check(key) {
      const bucket = buckets.get(key);
      if (!bucket) return { allowed: true };

      const now = Date.now();
      if (bucket.lockedUntil > now) {
        return { allowed: false, retryAfterSec: Math.ceil((bucket.lockedUntil - now) / 1000) };
      }
      if (now - bucket.firstFailureAt > options.windowMs) {
        buckets.delete(key);
      }
      return { allowed: true };
    },
    fail(key) {
      const now = Date.now();
      const bucket = buckets.get(key);
      if (!bucket || now - bucket.firstFailureAt > options.windowMs) {
        buckets.set(key, { failures: 1, firstFailureAt: now, lockedUntil: 0 });
        return;
      }
      bucket.failures += 1;
      if (bucket.failures >= options.maxFailures) {
        bucket.lockedUntil = now + options.lockMs;
      }
    },
    succeed(key) {
      buckets.delete(key);
    },
  };
}

/** 비밀번호 로그인: 10분 안에 5회 실패하면 15분 잠금. */
export const loginLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  maxFailures: 5,
  lockMs: 15 * 60 * 1000,
});

/**
 * TOTP/복구 코드 검증: 6자리라 무한 대입이 가능하므로 로그인보다 더 빡빡하게 잡는다.
 * 5분 안에 5회 실패 → 15분 잠금. 이 상태에서는 초당 수천 번을 던져도 시도 자체가 막힌다.
 */
export const twoFactorLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  maxFailures: 5,
  lockMs: 15 * 60 * 1000,
});

// 기존 호출부 호환용 래퍼 (비밀번호 로그인 전용).
export function checkLoginAllowed(key: string): { allowed: boolean; retryAfterSec?: number } {
  return loginLimiter.check(key);
}

export function recordLoginFailure(key: string): void {
  loginLimiter.fail(key);
}

export function recordLoginSuccess(key: string): void {
  loginLimiter.succeed(key);
}
