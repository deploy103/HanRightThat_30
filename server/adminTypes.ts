/** 관리자 인증/감사로그 전용 타입 (public 클라이언트와는 공유하지 않는다). */

export interface AdminUser {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface SessionRecord {
  /** 원본 세션 토큰은 저장하지 않고 sha256 해시만 저장한다. */
  tokenHash: string;
  adminUsername: string;
  createdAt: string;
  expiresAt: string;
  ip: string;
  userAgent: string;
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
  auditLogs: AuditLogEntry[];
}
