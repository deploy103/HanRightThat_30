import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as AuthModule from './auth.js';

let dir: string;
let auth: typeof AuthModule;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hanbit-auth-test-'));
  process.env.ADMIN_DB = join(dir, 'admin.json');
  process.env.SESSION_SECRET = 'test-secret';
  auth = await import('./auth.js');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.ADMIN_DB;
  delete process.env.SESSION_SECRET;
});

describe('비밀번호 해시', () => {
  it('올바른 비밀번호는 통과하고, 틀린 비밀번호는 거부한다', async () => {
    const hash = await auth.hashPassword('correct horse battery staple');
    expect(await auth.verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await auth.verifyPassword('wrong password', hash)).toBe(false);
  });

  it('같은 비밀번호도 매번 다른 해시(salt)를 만든다', async () => {
    const a = await auth.hashPassword('same-password');
    const b = await auth.hashPassword('same-password');
    expect(a).not.toBe(b);
  });
});

describe('세션', () => {
  it('발급한 세션은 검증에 성공하고, 로그아웃 후에는 실패한다', async () => {
    const session = await auth.createSession('admin', '127.0.0.1', 'vitest');
    expect(await auth.resolveSession(session.cookieValue)).toBe('admin');

    await auth.destroySession(session.cookieValue);
    expect(await auth.resolveSession(session.cookieValue)).toBeNull();
  });

  it('서명이 조작된 쿠키 값은 거부한다', async () => {
    const session = await auth.createSession('admin', '127.0.0.1', 'vitest');
    const [token] = session.cookieValue.split('.');
    const tampered = `${token}.0000000000000000000000000000000000000000000000000000000000000000`;
    expect(await auth.resolveSession(tampered)).toBeNull();
  });

  it('빈 값/형식이 다른 값은 안전하게 null을 반환한다', async () => {
    expect(await auth.resolveSession(undefined)).toBeNull();
    expect(await auth.resolveSession('garbage')).toBeNull();
  });
});

describe('CSRF 이중 제출 검증', () => {
  it('헤더와 쿠키 값이 같을 때만 통과한다', () => {
    expect(auth.verifyCsrf('abc', 'abc')).toBe(true);
    expect(auth.verifyCsrf('abc', 'def')).toBe(false);
    expect(auth.verifyCsrf(undefined, 'abc')).toBe(false);
  });
});

describe('createAdminUser', () => {
  it('같은 아이디로 두 번 만들면 실패한다', async () => {
    await auth.createAdminUser('dup-user', 'password1234');
    await expect(auth.createAdminUser('dup-user', 'password1234')).rejects.toThrow();
  });
});
