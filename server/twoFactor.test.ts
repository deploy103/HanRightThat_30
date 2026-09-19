import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as AuthModule from './auth.js';
import type * as TwoFactorModule from './twoFactor.js';
import type * as TotpModule from './totp.js';
import type * as AdminDbModule from './adminDb.js';

let dir: string;
let auth: typeof AuthModule;
let twoFactor: typeof TwoFactorModule;
let totp: typeof TotpModule;
let adminDb: typeof AdminDbModule;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hanbit-2fa-test-'));
  process.env.ADMIN_DB = join(dir, 'admin.json');
  process.env.SESSION_SECRET = 'test-secret';
  process.env.TOTP_ENCRYPTION_KEY = '11'.repeat(32);
  // 환경변수를 세팅한 뒤에 모듈을 읽어야 테스트용 경로/키가 적용된다.
  auth = await import('./auth.js');
  twoFactor = await import('./twoFactor.js');
  totp = await import('./totp.js');
  adminDb = await import('./adminDb.js');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.ADMIN_DB;
  delete process.env.SESSION_SECRET;
  delete process.env.TOTP_ENCRYPTION_KEY;
});

async function findUser(username: string) {
  const user = await auth.findAdminUser(username);
  if (!user) throw new Error(`테스트 계정을 찾을 수 없습니다: ${username}`);
  return user;
}

describe('TOTP secret 암호화', () => {
  it('암호문은 평문을 그대로 담고 있지 않고, 복호화하면 원래 값이 된다', () => {
    const secret = totp.generateTotpSecret();
    const encrypted = twoFactor.encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(twoFactor.decryptSecret(encrypted)).toBe(secret);
  });

  it('같은 값을 두 번 암호화해도 서로 다른 암호문이 된다 (IV 재사용 없음)', () => {
    const secret = totp.generateTotpSecret();
    expect(twoFactor.encryptSecret(secret)).not.toBe(twoFactor.encryptSecret(secret));
  });

  it('암호문이 한 글자라도 변조되면 복호화에 실패한다 (GCM 인증 태그)', () => {
    const encrypted = twoFactor.encryptSecret('ABCDEFGHIJKLMNOP');
    const parts = encrypted.split(':');
    parts[3] = `${parts[3].slice(0, -1)}${parts[3].endsWith('a') ? 'b' : 'a'}`;
    expect(() => twoFactor.decryptSecret(parts.join(':'))).toThrow();
  });
});

describe('2FA 등록', () => {
  it('새 계정은 2FA 가 꺼진 상태로 만들어진다', async () => {
    const user = await auth.createAdminUser('enroll-user', 'password1234');
    expect(user.twoFactorEnabled).toBe(false);
    expect(user.twoFactorSecretEncrypted).toBeNull();
  });

  it('QR 만 발급받고 코드를 검증하지 않으면 2FA 가 켜지지 않는다', async () => {
    await twoFactor.startTwoFactorSetup('enroll-user');
    const user = await findUser('enroll-user');
    expect(user.twoFactorEnabled).not.toBe(true);
    expect(user.pendingTwoFactorSecretEncrypted).toBeTruthy();
  });

  it('틀린 코드로는 활성화되지 않는다', async () => {
    const user = await findUser('enroll-user');
    const result = await twoFactor.enableTwoFactor(user, '000000');
    expect(result.ok).toBe(false);
    expect((await findUser('enroll-user')).twoFactorEnabled).not.toBe(true);
  });

  it('올바른 코드를 넣으면 활성화되고 복구 코드 10개를 1회만 돌려준다', async () => {
    const setup = await twoFactor.startTwoFactorSetup('enroll-user');
    const user = await findUser('enroll-user');
    const result = await twoFactor.enableTwoFactor(user, totp.generateTotp(setup.secret));

    expect(result.ok).toBe(true);
    expect(result.recoveryCodes).toHaveLength(10);
    expect(new Set(result.recoveryCodes)).toHaveLength(10);

    const enabled = await findUser('enroll-user');
    expect(enabled.twoFactorEnabled).toBe(true);
    expect(enabled.pendingTwoFactorSecretEncrypted).toBeNull();
    expect(enabled.twoFactorEnabledAt).toBeTruthy();
  });

  it('복구 코드는 평문이 아니라 해시로만 저장된다', async () => {
    const setup = await twoFactor.startTwoFactorSetup('hash-user-seed');
    expect(setup.secret).toBeTruthy();

    const data = await adminDb.loadAdminData();
    const user = await findUser('enroll-user');
    const stored = data.recoveryCodes.filter((entry) => entry.userId === user.id);
    expect(stored.length).toBeGreaterThan(0);
    for (const entry of stored) {
      expect(entry.codeHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    }
  });
});

describe('TOTP 로그인 검증', () => {
  let secret = '';

  beforeAll(async () => {
    await auth.createAdminUser('totp-user', 'password1234');
    const setup = await twoFactor.startTwoFactorSetup('totp-user');
    secret = setup.secret;
    await twoFactor.enableTwoFactor(await findUser('totp-user'), totp.generateTotp(secret));
  });

  it('틀린 코드는 거부한다', async () => {
    expect(await twoFactor.verifyTotpForUser(await findUser('totp-user'), '000000')).toBe(false);
  });

  it('같은 스텝의 코드는 두 번 쓸 수 없다 (replay 차단)', async () => {
    // 등록 시점에 현재 스텝이 이미 소비되었으므로 같은 코드는 다시 통하지 않는다.
    const code = totp.generateTotp(secret);
    expect(await twoFactor.verifyTotpForUser(await findUser('totp-user'), code)).toBe(false);

    // 다음 스텝의 코드는 정상적으로 통과한다.
    const nextCode = totp.generateTotp(secret, totp.totpStep() + 1);
    expect(await twoFactor.verifyTotpForUser(await findUser('totp-user'), nextCode)).toBe(true);
  });

  it('2FA 가 꺼진 계정은 어떤 코드로도 통과하지 못한다', async () => {
    await auth.createAdminUser('no-2fa-user', 'password1234');
    const user = await findUser('no-2fa-user');
    expect(await twoFactor.verifyTotpForUser(user, '123456')).toBe(false);
  });
});

describe('복구 코드', () => {
  let codes: string[] = [];

  beforeAll(async () => {
    await auth.createAdminUser('recovery-user', 'password1234');
    const setup = await twoFactor.startTwoFactorSetup('recovery-user');
    const result = await twoFactor.enableTwoFactor(await findUser('recovery-user'), totp.generateTotp(setup.secret));
    codes = result.recoveryCodes ?? [];
  });

  it('한 번은 통하지만 재사용하면 실패한다', async () => {
    const user = await findUser('recovery-user');
    expect(await twoFactor.consumeRecoveryCode(user, codes[0])).toBe(true);
    expect(await twoFactor.consumeRecoveryCode(user, codes[0])).toBe(false);
  });

  it('하이픈/대소문자가 달라도 같은 코드로 인정한다', async () => {
    const user = await findUser('recovery-user');
    expect(await twoFactor.consumeRecoveryCode(user, codes[1].replace('-', '').toLowerCase())).toBe(true);
  });

  it('없는 코드는 거부하고 남은 개수를 정확히 센다', async () => {
    const user = await findUser('recovery-user');
    expect(await twoFactor.consumeRecoveryCode(user, 'ZZZZZ-ZZZZZ')).toBe(false);
    expect(await twoFactor.countUnusedRecoveryCodes(user.id)).toBe(8);
  });

  it('다른 사용자의 복구 코드로는 통과할 수 없다', async () => {
    const other = await findUser('totp-user');
    expect(await twoFactor.consumeRecoveryCode(other, codes[2])).toBe(false);
  });
});

describe('2FA 초기화', () => {
  it('secret·복구 코드·세션을 모두 지우고 등록 전 상태로 되돌린다', async () => {
    await auth.createAdminUser('reset-user', 'password1234');
    const setup = await twoFactor.startTwoFactorSetup('reset-user');
    await twoFactor.enableTwoFactor(await findUser('reset-user'), totp.generateTotp(setup.secret));
    await auth.createSession('reset-user', '127.0.0.1', 'vitest', 'TWO_FACTOR_VERIFIED');

    const result = await twoFactor.resetTwoFactor('reset-user');
    expect(result.found).toBe(true);
    expect(result.removedRecoveryCodes).toBe(10);

    const user = await findUser('reset-user');
    expect(user.twoFactorEnabled).toBe(false);
    expect(user.twoFactorSecretEncrypted).toBeNull();

    const data = await adminDb.loadAdminData();
    expect(data.recoveryCodes.filter((entry) => entry.userId === user.id)).toHaveLength(0);
    expect(data.sessions.filter((session) => session.adminUsername === 'reset-user')).toHaveLength(0);
  });

  it('없는 계정이면 아무것도 바꾸지 않는다', async () => {
    expect(await twoFactor.resetTwoFactor('no-such-admin')).toEqual({ found: false, removedRecoveryCodes: 0 });
  });
});
