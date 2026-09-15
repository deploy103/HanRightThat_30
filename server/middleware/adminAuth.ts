import type { NextFunction, Request, Response } from 'express';
import { CSRF_COOKIE, SESSION_COOKIE, resolveSession, verifyCsrf } from '../auth.js';
import { readCookies } from '../cookies.js';
import { HttpError } from '../validate.js';

export interface AuthedRequest extends Request {
  adminUsername?: string;
}

/** 인증 여부만 판단한다. 실제 권한 검사는 항상 서버에서 하며, 프론트는 버튼 노출만 담당한다. */
export function requireAdminSession(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const cookies = readCookies(req);
  resolveSession(cookies[SESSION_COOKIE])
    .then((username) => {
      if (!username) {
        next(new HttpError(401, '로그인이 필요합니다.'));
        return;
      }
      req.adminUsername = username;
      next();
    })
    .catch(next);
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** GET 요청은 통과시키고, 상태를 바꾸는 요청만 double-submit CSRF 토큰을 요구한다. */
export function requireCsrf(req: Request, _res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }
  const cookies = readCookies(req);
  const header = req.header('x-csrf-token') ?? undefined;
  if (!verifyCsrf(header, cookies[CSRF_COOKIE])) {
    next(new HttpError(403, 'CSRF 토큰이 올바르지 않습니다.'));
    return;
  }
  next();
}
