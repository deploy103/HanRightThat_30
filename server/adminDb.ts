import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AdminData, SessionRecord, SessionStage } from './adminTypes.js';
import { createJsonStore } from './jsonStore.js';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, here.includes('dist-server') ? '../..' : '..');

/** 민감 데이터(비밀번호 해시, 세션, 감사로그)는 festival.json과 분리된 파일에 둔다. */
export const ADMIN_DATA_FILE = process.env.ADMIN_DB ?? join(projectRoot, 'data', 'admin.json');

function createSeedAdminData(): AdminData {
  return { adminUsers: [], sessions: [], recoveryCodes: [], auditLogs: [] };
}

const STAGES: SessionStage[] = ['PASSWORD_VERIFIED', 'TWO_FACTOR_VERIFIED'];

function normalizeAdminData(raw: unknown): AdminData {
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<AdminData>;
  return {
    adminUsers: Array.isArray(record.adminUsers) ? record.adminUsers : [],
    /**
     * stage 가 없는 세션은 2FA 도입 이전에 발급된 것이다. 이를 정식 세션으로 인정하면
     * 비밀번호만으로 발급된 쿠키가 그대로 2FA 를 건너뛰게 되므로 전부 버린다
     * (배포 직후 관리자는 한 번 다시 로그인해야 한다 — 의도된 동작).
     */
    sessions: Array.isArray(record.sessions)
      ? (record.sessions as SessionRecord[]).filter((session) => STAGES.includes(session?.stage))
      : [],
    recoveryCodes: Array.isArray(record.recoveryCodes) ? record.recoveryCodes : [],
    auditLogs: Array.isArray(record.auditLogs) ? record.auditLogs : [],
  };
}

const store = createJsonStore<AdminData>(ADMIN_DATA_FILE, createSeedAdminData, normalizeAdminData);

export const loadAdminData = store.load;
export const mutateAdminData = store.mutate;
export const resetAdminCache = store.resetCache;
