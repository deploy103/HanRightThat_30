import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { loadAdminData, mutateAdminData } from './adminDb.js';
import type { AdminUser, SessionRecord } from './adminTypes.js';

const scrypt = promisify(scryptCallback);

const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-only-insecure-secret-change-me';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS ?? 8) * 60 * 60 * 1000;

export const SESSION_COOKIE = 'hanbit_admin_session';
export const CSRF_COOKIE = 'hanbit_admin_csrf';

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.warn('[한빛제] SESSION_SECRET 환경변수가 설정되지 않았습니다. 운영 환경에서는 반드시 설정하세요.');
}

/** bcrypt 등 네이티브 의존성 없이 Node 내장 scrypt 로 비밀번호를 해시한다. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hashHex, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function sign(value: string): string {
  return createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreatedSession {
  cookieValue: string;
  csrfValue: string;
  expiresAt: string;
}

/** 로그인 성공 시 세션을 발급한다. 쿠키 값은 `token.서명` 형태로, 서버는 저장하지 않고 매번 서명을 검증한다. */
export async function createSession(username: string, ip: string, userAgent: string): Promise<CreatedSession> {
  const token = randomBytes(32).toString('hex');
  const signature = sign(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const record: SessionRecord = {
    tokenHash: hashToken(token),
    adminUsername: username,
    createdAt: new Date().toISOString(),
    expiresAt,
    ip,
    userAgent,
  };

  await mutateAdminData((current) => {
    const now = Date.now();
    // 만료된 세션은 매 로그인 시점에 정리한다 (별도 배치/크론 불필요).
    const sessions = current.sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
    return [{ ...current, sessions: [...sessions, record] }, undefined];
  });

  return { cookieValue: `${token}.${signature}`, csrfValue: randomBytes(16).toString('hex'), expiresAt };
}

/** 쿠키 값을 검증하고 유효하면 관리자 아이디를 반환한다. */
export async function resolveSession(cookieValue: string | undefined): Promise<string | null> {
  if (!cookieValue) return null;
  const [token, signature] = cookieValue.split('.');
  if (!token || !signature) return null;

  const expectedSignature = sign(token);
  const signatureBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
    return null;
  }

  const tokenHash = hashToken(token);
  const data = await loadAdminData();
  const record = data.sessions.find((session) => session.tokenHash === tokenHash);
  if (!record) return null;
  if (new Date(record.expiresAt).getTime() <= Date.now()) return null;
  return record.adminUsername;
}

export async function destroySession(cookieValue: string | undefined): Promise<void> {
  if (!cookieValue) return;
  const [token] = cookieValue.split('.');
  if (!token) return;
  const tokenHash = hashToken(token);
  await mutateAdminData((current) => [
    { ...current, sessions: current.sessions.filter((session) => session.tokenHash !== tokenHash) },
    undefined,
  ]);
}

/** double-submit 패턴: 로그인 시 발급한 csrf 쿠키 값과 요청 헤더 값이 같아야 통과한다. */
export function verifyCsrf(headerValue: string | undefined, cookieValue: string | undefined): boolean {
  if (!headerValue || !cookieValue) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(cookieValue);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function findAdminUser(username: string): Promise<AdminUser | undefined> {
  const data = await loadAdminData();
  return data.adminUsers.find((user) => user.username === username);
}

export async function touchLastLogin(username: string): Promise<void> {
  await mutateAdminData((current) => [
    {
      ...current,
      adminUsers: current.adminUsers.map((user) =>
        user.username === username ? { ...user, lastLoginAt: new Date().toISOString() } : user,
      ),
    },
    undefined,
  ]);
}

/** 운영자 계정 생성 CLI(`server/createAdmin.ts`)에서만 사용한다. */
export async function createAdminUser(username: string, password: string): Promise<AdminUser> {
  const passwordHash = await hashPassword(password);
  const user: AdminUser = {
    id: randomBytes(8).toString('hex'),
    username,
    passwordHash,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
  await mutateAdminData((current) => {
    if (current.adminUsers.some((existing) => existing.username === username)) {
      throw new Error(`이미 존재하는 아이디입니다: ${username}`);
    }
    return [{ ...current, adminUsers: [...current.adminUsers, user] }, user];
  });
  return user;
}
