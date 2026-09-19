import type { NextFunction, Request, Response } from 'express';
import { CSRF_COOKIE, SESSION_COOKIE, resolveSession, verifyCsrf } from '../auth.js';
import type { SessionStage } from '../adminTypes.js';
import { readCookies } from '../cookies.js';
import { HttpError } from '../validate.js';

export interface AuthedRequest extends Request {
  adminUsername?: string;
  sessionStage?: SessionStage;
}

function attachSession(req: AuthedRequest, required: SessionStage, next: NextFunction): void {
  const cookies = readCookies(req);
  resolveSession(cookies[SESSION_COOKIE])
    .then((session) => {
      if (!session) {
        next(new HttpError(401, '로그인이 필요합니다.'));
        return;
      }
      if (required === 'TWO_FACTOR_VERIFIED' && session.stage !== 'TWO_FACTOR_VERIFIED') {
        next(new HttpError(401, '2단계 인증을 완료해야 합니다.'));
        return;
      }
      if (required === 'PASSWORD_VERIFIED' && session.stage !== 'PASSWORD_VERIFIED') {
        next(new HttpError(400, '이미 인증이 끝난 세션입니다. 다시 로그인해 주세요.'));
        return;
      }
      req.adminUsername = session.username;
      req.sessionStage = session.stage;
      next();
    })
    .catch(next);
}

/**
 * 관리자 API 의 기본 관문 — 2FA 까지 끝난 세션만 통과한다.
 * 비밀번호만 통과한 임시 세션은 여기서 401 이 되므로, 프론트 화면을 우회해
 * API 를 직접 호출해도 2FA 를 건너뛸 수 없다. 권한 검사는 항상 서버가 한다.
 */
export function requireAdminSession(req: AuthedRequest, _res: Response, next: NextFunction): void {
  attachSession(req, 'TWO_FACTOR_VERIFIED', next);
}

/** 2FA 등록/검증 엔드포인트 전용 — "비밀번호만 통과한" 임시 세션에서만 호출할 수 있다. */
export function requirePendingSession(req: AuthedRequest, _res: Response, next: NextFunction): void {
  attachSession(req, 'PASSWORD_VERIFIED', next);
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
