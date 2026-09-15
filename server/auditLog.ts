import { randomBytes } from 'node:crypto';
import { loadAdminData, mutateAdminData } from './adminDb.js';
import type { AuditLogEntry } from './adminTypes.js';

/** 무한정 쌓이지 않도록 최근 N건만 유지한다 (짧은 축제 기간에는 충분한 여유치). */
const MAX_ENTRIES = 2000;

export interface RecordAuditLogInput {
  admin: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  ip: string;
}

export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  const entry: AuditLogEntry = {
    id: randomBytes(8).toString('hex'),
    timestamp: new Date().toISOString(),
    admin: input.admin,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    before: input.before ?? null,
    after: input.after ?? null,
    ip: input.ip,
  };
  await mutateAdminData((current) => {
    const auditLogs = [...current.auditLogs, entry].slice(-MAX_ENTRIES);
    return [{ ...current, auditLogs }, undefined];
  });
}

export async function listAuditLogs(limit = 200): Promise<AuditLogEntry[]> {
  const data = await loadAdminData();
  return data.auditLogs.slice(-limit).reverse();
}
