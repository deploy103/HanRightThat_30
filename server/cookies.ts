import { parse, serialize, type CookieSerializeOptions } from 'cookie';
import type { Request, Response } from 'express';
import { CSRF_COOKIE, SESSION_COOKIE, type CreatedSession } from './auth.js';

export function readCookies(req: Request): Record<string, string> {
  return parse(req.headers.cookie ?? '');
}

function cookieBase(): CookieSerializeOptions {
  return {
    path: '/',
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
}

export function setAuthCookies(res: Response, session: CreatedSession): void {
  const base = cookieBase();
  const expires = new Date(session.expiresAt);
  res.appendHeader('Set-Cookie', serialize(SESSION_COOKIE, session.cookieValue, { ...base, httpOnly: true, expires }));
  res.appendHeader('Set-Cookie', serialize(CSRF_COOKIE, session.csrfValue, { ...base, httpOnly: false, expires }));
}

export function clearAuthCookies(res: Response): void {
  const base = { ...cookieBase(), maxAge: 0 };
  res.appendHeader('Set-Cookie', serialize(SESSION_COOKIE, '', { ...base, httpOnly: true }));
  res.appendHeader('Set-Cookie', serialize(CSRF_COOKIE, '', { ...base, httpOnly: false }));
}
