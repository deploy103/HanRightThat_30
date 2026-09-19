/** 관리자 인증/감사로그 전용 타입 (public 클라이언트와는 공유하지 않는다). */

export interface AdminUser {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string | null;
  /** 2FA 등록이 끝났는지. false/undefined 면 다음 로그인 때 등록 화면으로 보낸다. */
  twoFactorEnabled?: boolean;
  /** AES-256-GCM 으로 암호화한 TOTP secret. 평문은 절대 저장/로그하지 않는다. */
  twoFactorSecretEncrypted?: string | null;
  twoFactorEnabledAt?: string | null;
  /** 등록 진행 중(아직 코드 검증 전)인 secret. enable 에 성공하면 위로 승격되고 지워진다. */
  pendingTwoFactorSecretEncrypted?: string | null;
  /** 마지막으로 성공한 TOTP 스텝. 같은 30초 코드를 두 번 쓰지 못하게 막는다(replay 차단). */
  lastTotpStep?: number | null;
}

/**
 * 인증 단계.
 * - PASSWORD_VERIFIED: 비밀번호만 통과한 임시 상태. 어떤 관리자 API 도 쓸 수 없다.
 * - TWO_FACTOR_VERIFIED: TOTP(또는 복구 코드)까지 통과한 정식 관리자 세션.
 */
export type SessionStage = 'PASSWORD_VERIFIED' | 'TWO_FACTOR_VERIFIED';

export interface SessionRecord {
  /** 원본 세션 토큰은 저장하지 않고 sha256 해시만 저장한다. */
  tokenHash: string;
  adminUsername: string;
  stage: SessionStage;
  createdAt: string;
  expiresAt: string;
  ip: string;
  userAgent: string;
}

/** 일회용 복구 코드. 원문은 발급 화면에서 한 번 보여 주고 서버에는 해시만 남긴다. */
export interface RecoveryCode {
  id: string;
  /** AdminUser.id */
  userId: string;
  codeHash: string;
  usedAt: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  admin: string;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
  ip: string;
}

export interface AdminData {
  adminUsers: AdminUser[];
  sessions: SessionRecord[];
  recoveryCodes: RecoveryCode[];
  auditLogs: AuditLogEntry[];
}
