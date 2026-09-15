import type { NextFunction, Request, Response } from 'express';

/**
 * 최소한의 방어적 헤더. helmet 같은 라이브러리 없이도 충분한 몇 가지만 직접 설정한다.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

/** 관리자 API 응답은 프록시/브라우저 캐시에 남으면 안 된다. */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
