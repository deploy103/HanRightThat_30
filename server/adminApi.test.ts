import type { Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as AuthModule from './auth.js';
import type * as TotpModule from './totp.js';
import type * as TwoFactorModule from './twoFactor.js';

/**
 * 실제 HTTP 서버를 띄워 관리자 API 를 끝에서 끝까지 확인한다.
 * 특히 "프론트 화면을 우회해 API 를 직접 호출했을 때 2FA 를 건너뛸 수 있는가" 를 본다.
 */

let dir: string;
let server: Server;
let baseUrl: string;
let totp: typeof TotpModule;
let twoFactor: typeof TwoFactorModule;
let auth: typeof AuthModule;

/** 아주 작은 쿠키 저장소 — 브라우저처럼 Set-Cookie 를 모아 두었다가 다시 보낸다. */
class CookieJar {
  private jar = new Map<string, string>();

  absorb(response: Response): void {
    for (const raw of response.headers.getSetCookie()) {
      const [pair] = raw.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value === '') this.jar.delete(name);
      else this.jar.set(name, value);
    }
  }

  header(): string {
    return [...this.jar].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  get(name: string): string | undefined {
    return this.jar.get(name);
  }

  clear(): void {
    this.jar.clear();
  }
}

interface CallOptions {
  method?: string;
  body?: unknown;
  jar?: CookieJar;
  /** CSRF 헤더를 일부러 빼고 싶을 때 false */
  csrf?: boolean;
  rawBody?: Buffer;
  contentType?: string;
}

/* 테스트 편의를 위해 응답 본문은 느슨한 타입으로 다룬다. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResponseBody = any;

async function call(path: string, options: CallOptions = {}): Promise<{ status: number; body: ResponseBody }> {
  const { method = 'GET', body, jar, csrf = true, rawBody, contentType } = options;
  const headers: Record<string, string> = {};
  if (jar) headers.cookie = jar.header();
  if (csrf && jar?.get('hanbit_admin_csrf')) headers['x-csrf-token'] = jar.get('hanbit_admin_csrf') as string;
  if (rawBody) headers['content-type'] = contentType ?? 'application/octet-stream';
  else if (body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  jar?.absorb(response);

  const text = await response.text();
  let parsed: ResponseBody = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hanbit-api-test-'));
  process.env.FESTIVAL_DB = join(dir, 'festival.json');
  process.env.ADMIN_DB = join(dir, 'admin.json');
  process.env.BOOTH_IMAGE_DIR = join(dir, 'booth-images');
  process.env.SESSION_SECRET = 'test-secret-for-admin-api-integration';
  process.env.TOTP_ENCRYPTION_KEY = 'ab'.repeat(32);

  const index = await import('./index.js');
  auth = await import('./auth.js');
  totp = await import('./totp.js');
  twoFactor = await import('./twoFactor.js');

  await auth.createAdminUser('tester', 'password-1234');

  server = index.createServer().listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (typeof address === 'string' || address === null) throw new Error('포트를 알 수 없습니다.');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(dir, { recursive: true, force: true });
  for (const key of ['FESTIVAL_DB', 'ADMIN_DB', 'BOOTH_IMAGE_DIR', 'SESSION_SECRET', 'TOTP_ENCRYPTION_KEY']) {
    delete process.env[key];
  }
});

// ---------------------------------------------------------------------------

describe('공개 API (인증 없음, 조회 전용)', () => {
  it('축제 데이터를 내려준다', async () => {
    const festival = await call('/api/public/festival');
    expect(festival.status).toBe(200);
    expect(Array.isArray(festival.body.booths)).toBe(true);
  });

  it('3층에 학부모 부스가 공개되어 있다', async () => {
    const { body } = await call('/api/public/booths');
    const parents = body.find((booth: { name: string }) => booth.name === '학부모 부스');
    expect(parents).toBeDefined();
    expect(parents.floor).toBe(3);
    expect(parents.place).toBe('3층 지능형소프트웨어과 1-1 앞');
  });

  it('공개 API 에는 쓰기 경로가 없다', async () => {
    for (const path of ['/api/public/booths', '/api/public/announcements', '/api/public/festival']) {
      const res = await call(path, { method: 'POST', body: {} });
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('게시되지 않은 공지는 공개 API 에 나오지 않는다', async () => {
    const { body } = await call('/api/public/announcements');
    expect(Array.isArray(body)).toBe(true);
    expect(body.every((item: { isPublished: boolean }) => item.isPublished)).toBe(true);
  });
});

describe('인증 없이 관리자 API 호출', () => {
  it('모두 401 이다', async () => {
    for (const path of ['/booths', '/announcements', '/settings', '/audit-logs', '/me', '/floor-plans']) {
      const res = await call(`/api/admin${path}`);
      expect(res.status).toBe(401);
    }
  });
});

// ---------------------------------------------------------------------------

describe('2FA 최초 등록 흐름', () => {
  const jar = new CookieJar();
  let secret = '';
  let recoveryCodes: string[] = [];

  it('비밀번호가 틀리면 401 이다', async () => {
    const res = await call('/api/admin/auth/login', {
      method: 'POST',
      body: { username: 'tester', password: 'wrong-password' },
      jar: new CookieJar(),
    });
    expect(res.status).toBe(401);
  });

  it('비밀번호가 맞으면 2FA 등록 단계로 안내한다', async () => {
    const res = await call('/api/admin/auth/login', {
      method: 'POST',
      body: { username: 'tester', password: 'password-1234' },
      jar,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'tester', stage: 'PASSWORD_VERIFIED', next: 'setup' });
  });

  it('비밀번호만 통과한 세션으로는 어떤 관리자 API 도 쓸 수 없다', async () => {
    expect((await call('/api/admin/booths', { jar })).status).toBe(401);
    expect((await call('/api/admin/announcements', { method: 'POST', body: { title: 'x', body: 'y' }, jar })).status).toBe(
      401,
    );
    expect((await call('/api/admin/settings', { method: 'PUT', body: { rankingsPublic: false }, jar })).status).toBe(401);
    expect((await call('/api/admin/booth-images', { method: 'POST', rawBody: PNG, contentType: 'image/png', jar })).status).toBe(
      401,
    );
  });

  it('setup 은 QR 과 secret 을 한 번 내려주지만 2FA 를 켜지는 않는다', async () => {
    const res = await call('/api/admin/auth/2fa/setup', { method: 'POST', jar });
    expect(res.status).toBe(200);
    expect(res.body.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(res.body.otpauthUrl.startsWith('otpauth://totp/')).toBe(true);
    expect(res.body.qrDataUrl.startsWith('data:image/')).toBe(true);
    secret = res.body.secret;

    // 아직 관리자 API 는 막혀 있어야 한다.
    expect((await call('/api/admin/booths', { jar })).status).toBe(401);
  });

  it('CSRF 토큰 없이 보내면 거부한다', async () => {
    const res = await call('/api/admin/auth/2fa/enable', {
      method: 'POST',
      body: { code: totp.generateTotp(secret) },
      jar,
      csrf: false,
    });
    expect(res.status).toBe(403);
  });

  it('틀린 코드로는 활성화되지 않는다', async () => {
    const res = await call('/api/admin/auth/2fa/enable', { method: 'POST', body: { code: '000000' }, jar });
    expect(res.status).toBe(401);
  });

  it('올바른 코드를 넣으면 활성화되고 복구 코드를 1회 내려준다', async () => {
    const res = await call('/api/admin/auth/2fa/enable', {
      method: 'POST',
      body: { code: totp.generateTotp(secret) },
      jar,
    });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('TWO_FACTOR_VERIFIED');
    expect(res.body.recoveryCodes).toHaveLength(10);
    recoveryCodes = res.body.recoveryCodes;
  });

  it('이제 관리자 API 를 정상적으로 쓸 수 있다', async () => {
    const res = await call('/api/admin/booths', { jar });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('2FA 상태 조회는 secret 을 노출하지 않는다', async () => {
    const res = await call('/api/admin/2fa/status', { jar });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ enabled: true, remainingRecoveryCodes: 10 });
    expect(JSON.stringify(res.body)).not.toContain(secret);
  });

  it('이미 등록된 계정은 setup 으로 secret 을 다시 받아낼 수 없다', async () => {
    // 재로그인해서 임시 세션을 만든 뒤 setup 을 시도한다.
    const attacker = new CookieJar();
    await call('/api/admin/auth/login', {
      method: 'POST',
      body: { username: 'tester', password: 'password-1234' },
      jar: attacker,
    });
    const res = await call('/api/admin/auth/2fa/setup', { method: 'POST', jar: attacker });
    expect(res.status).toBe(409);
  });

  it('세션 쿠키는 HttpOnly 이고 CSRF 쿠키만 스크립트에서 읽을 수 있다', async () => {
    const probe = new CookieJar();
    const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'tester', password: 'password-1234' }),
    });
    probe.absorb(response);
    const cookies = response.headers.getSetCookie();
    const session = cookies.find((cookie) => cookie.startsWith('hanbit_admin_session='));
    const csrf = cookies.find((cookie) => cookie.startsWith('hanbit_admin_csrf='));
    expect(session).toContain('HttpOnly');
    expect(csrf).not.toContain('HttpOnly');
    expect(session).toContain('SameSite=Lax');
  });

  describe('재로그인', () => {
    const relogin = new CookieJar();

    it('비밀번호 로그인 후에는 verify 단계로 안내한다', async () => {
      const res = await call('/api/admin/auth/login', {
        method: 'POST',
        body: { username: 'tester', password: 'password-1234' },
        jar: relogin,
      });
      expect(res.body).toMatchObject({ stage: 'PASSWORD_VERIFIED', twoFactorEnabled: true, next: 'verify' });
    });

    it('비밀번호만으로는 여전히 관리자 API 에 접근할 수 없다', async () => {
      expect((await call('/api/admin/booths', { jar: relogin })).status).toBe(401);
    });

    it('틀린 OTP 는 거부한다', async () => {
      const res = await call('/api/admin/auth/2fa/verify', { method: 'POST', body: { code: '123456' }, jar: relogin });
      expect(res.status).toBe(401);
    });

    it('올바른 OTP 로 통과하면 세션 토큰이 새로 발급된다 (session fixation 방지)', async () => {
      const before = relogin.get('hanbit_admin_session');
      // 등록 때 소비한 스텝과 겹치지 않도록 다음 스텝 코드를 쓴다.
      const code = totp.generateTotp(secret, totp.totpStep() + 1);
      const res = await call('/api/admin/auth/2fa/verify', { method: 'POST', body: { code }, jar: relogin });
      expect(res.status).toBe(200);
      expect(res.body.stage).toBe('TWO_FACTOR_VERIFIED');
      expect(relogin.get('hanbit_admin_session')).not.toBe(before);
      expect((await call('/api/admin/booths', { jar: relogin })).status).toBe(200);
    });
  });

  describe('복구 코드', () => {
    const jarB = new CookieJar();

    it('복구 코드로 로그인할 수 있다', async () => {
      await call('/api/admin/auth/login', {
        method: 'POST',
        body: { username: 'tester', password: 'password-1234' },
        jar: jarB,
      });
      const res = await call('/api/admin/auth/2fa/verify', {
        method: 'POST',
        body: { recoveryCode: recoveryCodes[0] },
        jar: jarB,
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ usedRecoveryCode: true, remainingRecoveryCodes: 9 });
    });

    it('한 번 쓴 복구 코드는 다시 쓸 수 없다', async () => {
      const jarC = new CookieJar();
      await call('/api/admin/auth/login', {
        method: 'POST',
        body: { username: 'tester', password: 'password-1234' },
        jar: jarC,
      });
      const res = await call('/api/admin/auth/2fa/verify', {
        method: 'POST',
        body: { recoveryCode: recoveryCodes[0] },
        jar: jarC,
      });
      expect(res.status).toBe(401);
    });

    it('복구 코드 사용이 감사 로그에 남는다', async () => {
      const { body } = await call('/api/admin/audit-logs?limit=100', { jar });
      const actions = body.map((entry: { action: string }) => entry.action);
      expect(actions).toContain('recovery_code_used');
      expect(actions).toContain('two_factor_enabled');
      // 민감정보가 로그에 남지 않아야 한다.
      const dump = JSON.stringify(body);
      expect(dump).not.toContain(secret);
      expect(dump).not.toContain('password-1234');
      for (const code of recoveryCodes) expect(dump).not.toContain(code);
    });
  });

  describe('OTP brute force 차단', () => {
    it('연속 실패하면 429 로 잠긴다', async () => {
      const jarD = new CookieJar();
      await call('/api/admin/auth/login', {
        method: 'POST',
        body: { username: 'brute-target', password: 'nope' },
        jar: jarD,
      });
      // 별도 계정을 만들어 잠금이 실제 계정 흐름을 방해하지 않게 한다.
      await auth.createAdminUser('brute-target', 'password-1234');
      const setup = await twoFactor.startTwoFactorSetup('brute-target');
      const user = await auth.findAdminUser('brute-target');
      await twoFactor.enableTwoFactor(user!, totp.generateTotp(setup.secret));

      const jarE = new CookieJar();
      await call('/api/admin/auth/login', {
        method: 'POST',
        body: { username: 'brute-target', password: 'password-1234' },
        jar: jarE,
      });

      const statuses: number[] = [];
      for (let i = 0; i < 7; i += 1) {
        const res = await call('/api/admin/auth/2fa/verify', { method: 'POST', body: { code: '000000' }, jar: jarE });
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(statuses.slice(5)).toEqual([429, 429]);
    });
  });

  describe('로그아웃', () => {
    it('로그아웃하면 세션이 무효화된다', async () => {
      const res = await call('/api/admin/auth/logout', { method: 'POST', jar });
      expect(res.status).toBe(204);
      jar.clear();
      expect((await call('/api/admin/booths', { jar })).status).toBe(401);
    });
  });
});

// ---------------------------------------------------------------------------

describe('관리자 CRUD (2FA 통과 세션)', () => {
  const jar = new CookieJar();
  let boothId = '';
  let uploadedPath = '';

  beforeAll(async () => {
    await auth.createAdminUser('crud-user', 'password-1234');
    const setup = await twoFactor.startTwoFactorSetup('crud-user');
    const user = await auth.findAdminUser('crud-user');
    await twoFactor.enableTwoFactor(user!, totp.generateTotp(setup.secret));

    await call('/api/admin/auth/login', {
      method: 'POST',
      body: { username: 'crud-user', password: 'password-1234' },
      jar,
    });
    await call('/api/admin/auth/2fa/verify', {
      method: 'POST',
      body: { code: totp.generateTotp(setup.secret, totp.totpStep() + 1) },
      jar,
    });
  });

  it('공지를 만들고 → 공개 API 에 뜨고 → 지운다', async () => {
    const created = await call('/api/admin/announcements', {
      method: 'POST',
      body: { title: '우천 시 안내', body: '비가 오면 체육관으로\n이동합니다.', isPublished: true },
      jar,
    });
    expect(created.status).toBe(201);
    expect(created.body.createdAt).toBeTruthy();
    expect(created.body.updatedAt).toBeTruthy();

    const published = await call('/api/public/announcements');
    expect(published.body.some((item: { id: string }) => item.id === created.body.id)).toBe(true);

    const updated = await call(`/api/admin/announcements/${created.body.id}`, {
      method: 'PUT',
      body: { title: '우천 시 안내(수정)', body: '체육관으로 이동합니다.', isPublished: true },
      jar,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe('우천 시 안내(수정)');

    const removed = await call(`/api/admin/announcements/${created.body.id}`, { method: 'DELETE', jar });
    expect(removed.status).toBe(204);

    const after = await call('/api/public/announcements');
    expect(after.body.some((item: { id: string }) => item.id === created.body.id)).toBe(false);
  });

  it('공지 본문은 HTML 로 해석되지 않고 텍스트 그대로 저장된다', async () => {
    const payload = '<script>alert(1)</script>';
    const created = await call('/api/admin/announcements', {
      method: 'POST',
      body: { title: 'XSS 시도', body: payload, isPublished: true },
      jar,
    });
    expect(created.body.body).toBe(payload);
    await call(`/api/admin/announcements/${created.body.id}`, { method: 'DELETE', jar });
  });

  it('이미지를 올리고 부스에 연결한 뒤 공개 화면에서 볼 수 있다', async () => {
    const upload = await call('/api/admin/booth-images', {
      method: 'POST',
      rawBody: PNG,
      contentType: 'image/png',
      jar,
    });
    expect(upload.status).toBe(201);
    expect(upload.body.imagePath).toMatch(/^\/booth-images\/[0-9a-f]{32}\.png$/);
    uploadedPath = upload.body.imagePath;

    // 정적 경로로 실제 서빙되는지 확인한다.
    const served = await fetch(`${baseUrl}${uploadedPath}`);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toContain('image/png');

    const booth = await call('/api/admin/booths', {
      method: 'POST',
      body: {
        name: '사진 부스',
        team: '테스트팀',
        floor: 2,
        amount: 1000,
        position: { x: 40, y: 76 },
        size: { w: 16, h: 12 },
        isPublic: true,
        isActive: true,
        imagePath: uploadedPath,
        imageAlt: '사진 부스 대표 이미지',
      },
      jar,
    });
    expect(booth.status).toBe(201);
    boothId = booth.body.id;

    const publicBooths = await call('/api/public/booths');
    const found = publicBooths.body.find((item: { id: string }) => item.id === boothId);
    expect(found.imagePath).toBe(uploadedPath);
    expect(found.size).toEqual({ w: 16, h: 12 });
  });

  it('CSRF 토큰 없는 업로드는 거부한다', async () => {
    const res = await call('/api/admin/booth-images', {
      method: 'POST',
      rawBody: PNG,
      contentType: 'image/png',
      jar,
      csrf: false,
    });
    expect(res.status).toBe(403);
  });

  it('이미지가 아닌 파일 업로드는 거부한다', async () => {
    const res = await call('/api/admin/booth-images', {
      method: 'POST',
      rawBody: Buffer.from('<?php system($_GET["c"]); ?>'),
      contentType: 'image/png',
      jar,
    });
    expect(res.status).toBe(400);
  });

  it('허용하지 않는 Content-Type 은 거부한다', async () => {
    const res = await call('/api/admin/booth-images', {
      method: 'POST',
      rawBody: Buffer.from('<svg onload="alert(1)"/>'),
      contentType: 'image/svg+xml',
      jar,
    });
    expect(res.status).toBe(400);
  });

  it('용량 제한을 넘는 업로드는 413 으로 거부한다', async () => {
    const tooBig = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024, 0)]);
    const res = await call('/api/admin/booth-images', {
      method: 'POST',
      rawBody: tooBig,
      contentType: 'image/png',
      jar,
    });
    expect(res.status).toBe(413);
  });

  it('사용 중인 이미지는 지울 수 없고, 연결을 끊으면 지울 수 있다', async () => {
    const name = uploadedPath.replace('/booth-images/', '');
    const blocked = await call(`/api/admin/booth-images/${name}`, { method: 'DELETE', jar });
    expect(blocked.status).toBe(409);

    await call(`/api/admin/booths/${boothId}`, {
      method: 'PUT',
      body: {
        name: '사진 부스',
        team: '테스트팀',
        floor: 2,
        amount: 1000,
        position: { x: 40, y: 76 },
        size: { w: 16, h: 12 },
        isPublic: true,
        isActive: true,
        imagePath: '',
        imageAlt: '',
      },
      jar,
    });

    const removed = await call(`/api/admin/booth-images/${name}`, { method: 'DELETE', jar });
    expect(removed.status).toBe(204);
    expect((await fetch(`${baseUrl}${uploadedPath}`)).status).toBe(404);
  });

  it('부스를 GUI 편집기처럼 이동/크기 변경하면 새로고침 후에도 유지된다', async () => {
    const moved = await call(`/api/admin/booths/${boothId}`, {
      method: 'PUT',
      body: {
        name: '사진 부스',
        team: '테스트팀',
        floor: 3,
        amount: 1000,
        position: { x: 61.5, y: 76 },
        size: { w: 22, h: 14 },
        isPublic: true,
        isActive: true,
      },
      jar,
    });
    expect(moved.status).toBe(200);

    const reloaded = await call('/api/admin/booths', { jar });
    const booth = reloaded.body.find((item: { id: string }) => item.id === boothId);
    expect(booth).toMatchObject({ floor: 3, position: { x: 61.5, y: 76 }, size: { w: 22, h: 14 } });
  });

  it('배치도 밖으로 끌어 놓으려 해도 서버가 안쪽으로 되돌린다', async () => {
    const res = await call(`/api/admin/booths/${boothId}`, {
      method: 'PUT',
      body: {
        name: '사진 부스',
        team: '테스트팀',
        floor: 3,
        amount: 1000,
        position: { x: 200, y: -50 },
        size: { w: 20, h: 10 },
        isPublic: true,
        isActive: true,
      },
      jar,
    });
    expect(res.body.position).toEqual({ x: 90, y: 5 });
  });

  it('부스를 보관하면 공개 화면에서 사라지고, 복원하면 돌아온다', async () => {
    await call(`/api/admin/booths/${boothId}`, { method: 'DELETE', jar });
    let publicBooths = await call('/api/public/booths');
    expect(publicBooths.body.some((item: { id: string }) => item.id === boothId)).toBe(false);

    await call(`/api/admin/booths/${boothId}/restore`, { method: 'POST', jar });
    await call(`/api/admin/booths/${boothId}`, {
      method: 'PUT',
      body: {
        name: '사진 부스',
        team: '테스트팀',
        floor: 3,
        amount: 1000,
        position: { x: 61.5, y: 76 },
        isPublic: true,
        isActive: true,
      },
      jar,
    });
    publicBooths = await call('/api/public/booths');
    expect(publicBooths.body.some((item: { id: string }) => item.id === boothId)).toBe(true);
  });

  it('층 배치도를 공개 렌더러와 같은 좌표계로 내려준다', async () => {
    const plans = await call('/api/admin/floor-plans', { jar });
    expect(plans.status).toBe(200);
    expect(plans.body.floors.map((floor: { id: number }) => floor.id)).toEqual([2, 3]);
    expect(plans.body.aspect).toEqual({ width: 660, height: 470 });
    expect(plans.body.defaultBoothSize).toEqual({ w: 14, h: 10 });
    expect(plans.body.minBoothSize).toEqual({ w: 4, h: 4 });
    // 왼쪽 계단이 제거되어 계단은 층마다 하나뿐이다.
    for (const floor of plans.body.floors) {
      const stairs = floor.rooms.filter((room: { tone: string }) => room.tone === 'stair');
      expect(stairs).toHaveLength(1);
      expect(stairs[0].id).toBe(`${floor.id}-stair-right`);
    }
  });

  it('기존 기능(공연/일정/설정/순위)이 그대로 동작한다', async () => {
    const show = await call('/api/admin/performances', {
      method: 'POST',
      body: { time: '16:30', team: '테스트팀', title: '앵콜' },
      jar,
    });
    expect(show.status).toBe(201);
    expect((await call(`/api/admin/performances/${show.body.id}`, { method: 'DELETE', jar })).status).toBe(204);

    const item = await call('/api/admin/schedule', {
      method: 'POST',
      body: { time: '11:00', title: '리허설' },
      jar,
    });
    expect(item.status).toBe(201);
    expect((await call(`/api/admin/schedule/${item.body.id}`, { method: 'DELETE', jar })).status).toBe(204);

    expect((await call('/api/admin/settings', { method: 'PUT', body: { rankingsPublic: true }, jar })).status).toBe(200);
    expect((await call('/api/admin/rankings', { jar })).status).toBe(200);
    expect((await call('/api/admin/landing', { jar })).status).toBe(200);
  });
});
