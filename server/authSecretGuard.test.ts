import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * NODE_ENV=production 인데 SESSION_SECRET 이 없거나 짧으면 "일단 뜨는" 안전하지 않은
 * 배포를 막기 위해 모듈 로드 시점에 죽어야 한다 (server/auth.ts 최상단 가드).
 */

let prevEnv: string | undefined;
let prevSecret: string | undefined;

beforeEach(() => {
  prevEnv = process.env.NODE_ENV;
  prevSecret = process.env.SESSION_SECRET;
  vi.resetModules();
});

afterEach(() => {
  process.env.NODE_ENV = prevEnv;
  process.env.SESSION_SECRET = prevSecret;
  vi.resetModules();
});

describe('운영 환경 SESSION_SECRET 강제', () => {
  it('짧은 SESSION_SECRET 으로는 모듈 로드 자체가 실패한다', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'too-short';
    await expect(import('./auth.js')).rejects.toThrow(/SESSION_SECRET/);
  });

  it('SESSION_SECRET 이 아예 없어도 실패한다', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;
    await expect(import('./auth.js')).rejects.toThrow(/SESSION_SECRET/);
  });

  it('32자 이상이면 정상적으로 로드된다', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'a'.repeat(32);
    const mod = await import('./auth.js');
    expect(typeof mod.hashPassword).toBe('function');
  });

  it('production 이 아니면 짧거나 없어도 경고 없이 개발용 기본값으로 뜬다', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.SESSION_SECRET;
    const mod = await import('./auth.js');
    expect(typeof mod.hashPassword).toBe('function');
  });
});
