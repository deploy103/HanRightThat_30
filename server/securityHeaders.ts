import type { NextFunction, Request, Response } from 'express';

/**
 * index.html이 실제로 불러오는 출처만 허용한다(Google Fonts 스타일시트/폰트, 같은 오리진 API).
 * 이 Express 앱은 production 빌드(dist/)를 직접 서빙할 때만 브라우저가 이 헤더를 받는다 —
 * 개발 중에는 Vite dev 서버가 별도 포트에서 HTML을 서빙하므로 영향받지 않는다.
 */
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; " +
  "frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

/**
 * 최소한의 방어적 헤더. helmet 같은 라이브러리 없이도 충분한 몇 가지만 직접 설정한다.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', CSP);
  next();
}

/** 관리자 API 응답은 프록시/브라우저 캐시에 남으면 안 된다. */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
