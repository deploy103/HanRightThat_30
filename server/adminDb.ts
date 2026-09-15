import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AdminData } from './adminTypes.js';
import { createJsonStore } from './jsonStore.js';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, here.includes('dist-server') ? '../..' : '..');

/** 민감 데이터(비밀번호 해시, 세션, 감사로그)는 festival.json과 분리된 파일에 둔다. */
export const ADMIN_DATA_FILE = process.env.ADMIN_DB ?? join(projectRoot, 'data', 'admin.json');

function createSeedAdminData(): AdminData {
  return { adminUsers: [], sessions: [], auditLogs: [] };
}

function normalizeAdminData(raw: unknown): AdminData {
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<AdminData>;
  return {
    adminUsers: Array.isArray(record.adminUsers) ? record.adminUsers : [],
    sessions: Array.isArray(record.sessions) ? record.sessions : [],
    auditLogs: Array.isArray(record.auditLogs) ? record.auditLogs : [],
  };
}

const store = createJsonStore<AdminData>(ADMIN_DATA_FILE, createSeedAdminData, normalizeAdminData);

export const loadAdminData = store.load;
export const mutateAdminData = store.mutate;
export const resetAdminCache = store.resetCache;
