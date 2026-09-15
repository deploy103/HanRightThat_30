import type { NextFunction, Request, Response } from 'express';

const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? '';

/**
 * /api/admin/* 요청에만 적용한다. ADMIN_ORIGIN 과 정확히 일치하는 Origin 만
 * 자격증명 포함 요청을 허용해, admin.hanwol.site 이외의 사이트가 세션 쿠키로
 * 관리자 API 를 호출할 수 없게 한다.
 */
export function adminCors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.header('origin');
  if (origin && ADMIN_ORIGIN && origin === ADMIN_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
    res.setHeader('Access-Control-Max-Age', '600');
    res.status(204).end();
    return;
  }
  next();
}
