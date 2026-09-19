import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { loadAdminData, mutateAdminData } from './adminDb.js';
import type { AdminUser, SessionRecord, SessionStage } from './adminTypes.js';

const scrypt = promisify(scryptCallback);

const isProduction = process.env.NODE_ENV === 'production';
const rawSecret = process.env.SESSION_SECRET ?? '';

/**
 * 운영에서 SESSION_SECRET 이 없거나 너무 짧으면(추측 가능한 수준) 조용히 넘어가지 않고
 * 즉시 기동을 실패시킨다. "일단 뜨긴 뜨는" 안전하지 않은 배포를 막기 위함이다.
 */
if (isProduction && rawSecret.length < 32) {
  throw new Error(
    '[한빛제] 운영 환경(NODE_ENV=production)에서는 SESSION_SECRET 을 32자 이상으로 설정해야 합니다. ' +
      '예: openssl rand -hex 32',
  );
}

const SESSION_SECRET = rawSecret || 'dev-only-insecure-secret-change-me';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS ?? 8) * 60 * 60 * 1000;

/**
 * 비밀번호만 통과한 임시 세션의 수명. 2FA 화면을 넘기기에는 넉넉하고,
 * 훔쳐도 오래 쓸 수 없을 만큼은 짧게 잡는다.
 */
const PENDING_SESSION_TTL_MS = 5 * 60 * 1000;

export const SESSION_COOKIE = 'hanbit_admin_session';
export const CSRF_COOKIE = 'hanbit_admin_csrf';

/**
 * 존재하지 않는 아이디로 로그인 시도할 때 scrypt 계산 자체를 건너뛰면, 응답 시간 차이로
 * "이 아이디는 존재하지 않는다"를 외부에서 추측할 수 있다(타이밍 사이드채널을 통한 계정 열거).
 * 이를 막기 위해 아이디가 없을 때도 이 더미 해시로 동일하게 scrypt 검증을 수행한다.
 */
export const DUMMY_PASSWORD_HASH = (() => {
  const salt = '0'.repeat(32);
  const derived = scryptSync('timing-safety-dummy-password', salt, 64);
  return `${salt}:${derived.toString('hex')}`;
})();

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
  stage: SessionStage;
}

export interface ResolvedSession {
  username: string;
  stage: SessionStage;
}

/**
 * 세션을 발급한다. 쿠키 값은 `token.서명` 형태로, 서버는 원본 토큰을 저장하지 않고 매번 서명을 검증한다.
 *
 * stage 로 "비밀번호만 통과" 와 "2FA까지 통과" 를 명확히 구분한다 —
 * 비밀번호 단계에서 발급된 쿠키로는 어떤 관리자 API 도 호출할 수 없다.
 */
export async function createSession(
  username: string,
  ip: string,
  userAgent: string,
  stage: SessionStage,
): Promise<CreatedSession> {
  const token = randomBytes(32).toString('hex');
  const signature = sign(token);
  const ttl = stage === 'TWO_FACTOR_VERIFIED' ? SESSION_TTL_MS : PENDING_SESSION_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  const record: SessionRecord = {
    tokenHash: hashToken(token),
    adminUsername: username,
    stage,
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

  return { cookieValue: `${token}.${signature}`, csrfValue: randomBytes(16).toString('hex'), expiresAt, stage };
}

/**
 * 2FA 통과 시 임시 세션을 버리고 새 토큰/새 CSRF 값을 발급한다.
 * 토큰이 바뀌므로 로그인 전에 심어 둔 쿠키를 그대로 승격시키는 session fixation 이 불가능하다.
 */
export async function upgradeSessionToFull(
  pendingCookieValue: string | undefined,
  username: string,
  ip: string,
  userAgent: string,
): Promise<CreatedSession> {
  await destroySession(pendingCookieValue);
  return createSession(username, ip, userAgent, 'TWO_FACTOR_VERIFIED');
}

/** 쿠키 값을 검증하고 유효하면 관리자 아이디와 인증 단계를 반환한다. */
export async function resolveSession(cookieValue: string | undefined): Promise<ResolvedSession | null> {
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
  return { username: record.adminUsername, stage: record.stage };
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
    // 새 계정도 첫 로그인 때 2FA 등록 화면을 거친다.
    twoFactorEnabled: false,
    twoFactorSecretEncrypted: null,
    pendingTwoFactorSecretEncrypted: null,
    twoFactorEnabledAt: null,
    lastTotpStep: null,
  };
  await mutateAdminData((current) => {
    if (current.adminUsers.some((existing) => existing.username === username)) {
      throw new Error(`이미 존재하는 아이디입니다: ${username}`);
    }
    return [{ ...current, adminUsers: [...current.adminUsers, user] }, user];
  });
  return user;
}
