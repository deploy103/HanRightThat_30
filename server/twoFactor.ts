import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { loadAdminData, mutateAdminData } from './adminDb.js';
import type { AdminUser, RecoveryCode } from './adminTypes.js';
import { hashPassword, verifyPassword } from './auth.js';
import {
  buildOtpauthUrl,
  generateTotpSecret,
  totpStep,
  verifyTotp,
  type TotpVerifyResult,
} from './totp.js';

const isProduction = process.env.NODE_ENV === 'production';

/** 인증 앱 목록에 표시되는 이름. */
export const TOTP_ISSUER = process.env.TOTP_ISSUER ?? 'Hanbit Festival Admin';

/**
 * TOTP secret 을 감싸는 대칭키.
 *
 * 운영에서는 반드시 32바이트(hex 64자) 랜덤값을 환경변수로 주입해야 한다. 키가 DB 파일과
 * 같은 곳에 있으면 암호화의 의미가 없으므로, 코드에도 admin.json 에도 저장하지 않는다.
 *   예: openssl rand -hex 32
 */
const RAW_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY ?? '';

if (isProduction && !/^[0-9a-fA-F]{64}$/.test(RAW_ENCRYPTION_KEY)) {
  throw new Error(
    '[한빛제] 운영 환경(NODE_ENV=production)에서는 TOTP_ENCRYPTION_KEY 를 64자리 hex(32바이트)로 설정해야 합니다. ' +
      '예: openssl rand -hex 32',
  );
}

/** 개발 환경에서만 쓰는 고정 키 — 운영에서는 위 가드가 먼저 기동을 막는다. */
const ENCRYPTION_KEY = /^[0-9a-fA-F]{64}$/.test(RAW_ENCRYPTION_KEY)
  ? Buffer.from(RAW_ENCRYPTION_KEY, 'hex')
  : scryptSync(process.env.SESSION_SECRET ?? 'dev-only-insecure-secret-change-me', 'hanbit-totp-dev', 32);

const CIPHER_VERSION = 'v1';

/** AES-256-GCM. 포맷: v1:<iv>:<authTag>:<ciphertext> (모두 hex). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [CIPHER_VERSION, iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptSecret(stored: string): string {
  const [version, ivHex, tagHex, dataHex] = stored.split(':');
  if (version !== CIPHER_VERSION || !ivHex || !tagHex || !dataHex) {
    throw new Error('저장된 2단계 인증 정보를 읽을 수 없습니다.');
  }
  const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

// ---------------------------------------------------------------------------
// 등록 (setup → enable)
// ---------------------------------------------------------------------------

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
}

/**
 * 새 secret 을 만들어 "등록 대기" 슬롯에 저장하고, 화면에 보여 줄 값만 돌려준다.
 * 이 시점에는 아직 2FA 가 켜지지 않는다 — 코드 검증(enable)을 통과해야 한다.
 */
export async function startTwoFactorSetup(username: string): Promise<TwoFactorSetup> {
  const secret = generateTotpSecret();
  const encrypted = encryptSecret(secret);
  await mutateAdminData((current) => [
    {
      ...current,
      adminUsers: current.adminUsers.map((user) =>
        user.username === username ? { ...user, pendingTwoFactorSecretEncrypted: encrypted } : user,
      ),
    },
    undefined,
  ]);
  return { secret, otpauthUrl: buildOtpauthUrl(TOTP_ISSUER, username, secret) };
}

export interface EnableResult {
  ok: boolean;
  /** 최초 1회만 노출되는 복구 코드 원문. */
  recoveryCodes?: string[];
  reason?: 'no-pending' | 'invalid-code';
}

/** 대기 중인 secret 으로 코드를 검증하고, 성공하면 2FA 를 켜고 복구 코드를 새로 발급한다. */
export async function enableTwoFactor(user: AdminUser, code: string): Promise<EnableResult> {
  if (!user.pendingTwoFactorSecretEncrypted) return { ok: false, reason: 'no-pending' };

  const secret = decryptSecret(user.pendingTwoFactorSecretEncrypted);
  const result = verifyTotp(secret, code);
  if (!result.valid) return { ok: false, reason: 'invalid-code' };

  const plainCodes = generateRecoveryCodePlaintexts();
  const now = new Date().toISOString();
  const hashed: RecoveryCode[] = [];
  for (const plain of plainCodes) {
    hashed.push({
      id: randomUUID(),
      userId: user.id,
      codeHash: await hashPassword(normalizeRecoveryCode(plain)),
      usedAt: null,
      createdAt: now,
    });
  }

  await mutateAdminData((current) => [
    {
      ...current,
      adminUsers: current.adminUsers.map((candidate) =>
        candidate.id === user.id
          ? {
              ...candidate,
              twoFactorEnabled: true,
              twoFactorSecretEncrypted: candidate.pendingTwoFactorSecretEncrypted ?? null,
              pendingTwoFactorSecretEncrypted: null,
              twoFactorEnabledAt: now,
              lastTotpStep: result.step ?? totpStep(),
            }
          : candidate,
      ),
      // 재등록이면 예전 복구 코드는 전부 무효로 만든다.
      recoveryCodes: [...current.recoveryCodes.filter((entry) => entry.userId !== user.id), ...hashed],
    },
    undefined,
  ]);

  return { ok: true, recoveryCodes: plainCodes };
}

// ---------------------------------------------------------------------------
// 로그인 시 검증
// ---------------------------------------------------------------------------

/**
 * TOTP 코드를 검증한다.
 * 성공한 스텝을 기록해 같은 코드를 두 번 쓰는 것(어깨너머로 본 코드 재사용)을 막는다.
 */
export async function verifyTotpForUser(user: AdminUser, code: string): Promise<boolean> {
  if (!user.twoFactorEnabled || !user.twoFactorSecretEncrypted) return false;
  const secret = decryptSecret(user.twoFactorSecretEncrypted);
  const result: TotpVerifyResult = verifyTotp(secret, code);
  if (!result.valid || result.step === undefined) return false;
  if (user.lastTotpStep != null && result.step <= user.lastTotpStep) return false;

  await mutateAdminData((current) => [
    {
      ...current,
      adminUsers: current.adminUsers.map((candidate) =>
        candidate.id === user.id ? { ...candidate, lastTotpStep: result.step ?? null } : candidate,
      ),
    },
    undefined,
  ]);
  return true;
}

/** 복구 코드 검증. 성공하면 그 코드는 즉시 사용 처리되어 다시는 통하지 않는다. */
export async function consumeRecoveryCode(user: AdminUser, rawCode: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(rawCode);
  if (!/^[0-9A-Z]{10}$/.test(normalized)) return false;

  const data = await loadAdminData();
  const candidates = data.recoveryCodes.filter((entry) => entry.userId === user.id && !entry.usedAt);

  let matchedId: string | null = null;
  for (const entry of candidates) {
    // 일치하는 코드를 찾아도 끝까지 돌아 남은 코드 개수가 응답 시간으로 드러나지 않게 한다.
    if (await verifyPassword(normalized, entry.codeHash)) matchedId = entry.id;
  }
  if (!matchedId) return false;

  return mutateAdminData<boolean>((current) => {
    const target = current.recoveryCodes.find((entry) => entry.id === matchedId);
    // 동시에 같은 코드를 두 번 보냈다면 먼저 온 쪽만 성공한다.
    if (!target || target.usedAt) return [current, false];
    return [
      {
        ...current,
        recoveryCodes: current.recoveryCodes.map((entry) =>
          entry.id === matchedId ? { ...entry, usedAt: new Date().toISOString() } : entry,
        ),
      },
      true,
    ];
  });
}

export async function countUnusedRecoveryCodes(userId: string): Promise<number> {
  const data = await loadAdminData();
  return data.recoveryCodes.filter((entry) => entry.userId === userId && !entry.usedAt).length;
}

// ---------------------------------------------------------------------------
// 복구 코드 생성
// ---------------------------------------------------------------------------

const RECOVERY_CODE_COUNT = 10;
/** 사람이 옮겨 적을 때 헷갈리는 0/O, 1/I 를 뺀 알파벳. */
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** 표시 형식은 "ABCDE-FGHJK", 비교는 하이픈을 뺀 대문자 10자로 한다. */
export function normalizeRecoveryCode(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

function generateRecoveryCodePlaintexts(): string[] {
  const codes: string[] = [];
  while (codes.length < RECOVERY_CODE_COUNT) {
    const bytes = randomBytes(10);
    const chars = Array.from(bytes, (byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length]).join('');
    const code = `${chars.slice(0, 5)}-${chars.slice(5)}`;
    if (!codes.includes(code)) codes.push(code);
  }
  return codes;
}

// ---------------------------------------------------------------------------
// 초기화 (운영자 CLI 전용)
// ---------------------------------------------------------------------------

export interface ResetResult {
  found: boolean;
  removedRecoveryCodes: number;
}

/**
 * 인증 앱을 분실했을 때 쓰는 초기화. 로그인 화면에는 절대 노출하지 않고
 * 서버 접근 권한이 있는 사람만 CLI(`npm run admin:reset-2fa`)로 실행한다.
 * 해당 관리자의 세션도 모두 끊어 재로그인 → 재등록을 강제한다.
 */
export async function resetTwoFactor(username: string): Promise<ResetResult> {
  return mutateAdminData<ResetResult>((current) => {
    const user = current.adminUsers.find((candidate) => candidate.username === username);
    if (!user) return [current, { found: false, removedRecoveryCodes: 0 }];

    const removed = current.recoveryCodes.filter((entry) => entry.userId === user.id).length;
    return [
      {
        ...current,
        adminUsers: current.adminUsers.map((candidate) =>
          candidate.id === user.id
            ? {
                ...candidate,
                twoFactorEnabled: false,
                twoFactorSecretEncrypted: null,
                pendingTwoFactorSecretEncrypted: null,
                twoFactorEnabledAt: null,
                lastTotpStep: null,
              }
            : candidate,
        ),
        recoveryCodes: current.recoveryCodes.filter((entry) => entry.userId !== user.id),
        sessions: current.sessions.filter((session) => session.adminUsername !== username),
      },
      { found: true, removedRecoveryCodes: removed },
    ];
  });
}

/** 감사로그/디버깅용 지문. secret 자체는 절대 로그에 남기지 않는다. */
export function secretFingerprint(encrypted: string | null | undefined): string {
  if (!encrypted) return 'none';
  return createHash('sha256').update(encrypted).digest('hex').slice(0, 8);
}
