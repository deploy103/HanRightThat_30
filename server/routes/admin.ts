import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import { rankBooths } from '../../shared/ranking.js';
import type { Announcement, Booth, LandingState, ScheduleItem, Show } from '../../shared/types.js';
import { loadAdminData } from '../adminDb.js';
import { visibleBooths } from '../publicView.js';
import { boothImageFileExists } from '../assets.js';
import { listAuditLogs, recordAuditLog } from '../auditLog.js';
import {
  createSession,
  destroySession,
  DUMMY_PASSWORD_HASH,
  findAdminUser,
  resolveSession,
  SESSION_COOKIE,
  touchLastLogin,
  verifyPassword,
} from '../auth.js';
import { clearAuthCookies, readCookies, setAuthCookies } from '../cookies.js';
import { loadData, mutate } from '../db.js';
import { type AuthedRequest, requireAdminSession, requireCsrf } from '../middleware/adminAuth.js';
import { checkLoginAllowed, recordLoginFailure, recordLoginSuccess } from '../rateLimit.js';
import { asyncRoute } from '../routeUtils.js';
import {
  HttpError,
  parseAnnouncementInput,
  parseBoothInput,
  parseIdList,
  parseLandingContent,
  parseMetaInput,
  parseScheduleItemInput,
  parseSettingsInput,
  parseShowInput,
} from '../validate.js';

/** 새로 지정한 이미지 경로가 실제로 저장소에 있는지 확인한다 (형식 검사는 parseBoothInput이 이미 했다). */
function assertBoothImageExists(imagePath: string): void {
  if (imagePath && !boothImageFileExists(imagePath)) {
    throw new HttpError(400, '이미지 경로에 해당하는 파일을 저장소에서 찾을 수 없습니다.');
  }
}

function readExpectedRevision(body: unknown): number {
  const raw = (body ?? {}) as { expectedRevision?: unknown };
  const revision = typeof raw.expectedRevision === 'string' ? Number(raw.expectedRevision) : raw.expectedRevision;
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) {
    throw new HttpError(400, 'expectedRevision 값이 올바르지 않습니다.');
  }
  return revision;
}

function clientIp(req: { ip?: string }): string {
  return req.ip ?? 'unknown';
}

function renumberShows(shows: Show[]): Show[] {
  return shows.map((show, index) => ({ ...show, order: index + 1 }));
}

function findIndexOrThrow<T extends { id: string }>(items: T[], id: string, label: string): number {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) throw new HttpError(404, `${label}을(를) 찾을 수 없습니다.`);
  return index;
}

export const adminRouter = Router();

// ---------------------------------------------------------------------------
// 인증 (아래 라우트들은 세션/CSRF 미들웨어보다 먼저 등록해 예외로 둔다)
// ---------------------------------------------------------------------------

adminRouter.post(
  '/auth/login',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { username?: unknown; password?: unknown };
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || !password) throw new HttpError(400, '아이디와 비밀번호를 입력해 주세요.');

    const ip = clientIp(req);
    const key = `${ip}:${username}`;
    const gate = checkLoginAllowed(key);
    if (!gate.allowed) {
      throw new HttpError(429, `로그인 시도가 너무 많습니다. ${gate.retryAfterSec}초 후 다시 시도해 주세요.`);
    }

    const user = await findAdminUser(username);
    // 아이디가 없어도 동일하게 scrypt 검증을 수행해 존재 여부가 응답 시간으로 드러나지 않게 한다.
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !ok) {
      recordLoginFailure(key);
      await recordAuditLog({ admin: username, action: 'login_failed', targetType: 'session', targetId: username, ip });
      throw new HttpError(401, '아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    recordLoginSuccess(key);
    await touchLastLogin(username);
    const session = await createSession(username, ip, req.header('user-agent') ?? '');
    setAuthCookies(res, session);
    await recordAuditLog({ admin: username, action: 'login_success', targetType: 'session', targetId: username, ip });
    res.json({ username });
  }),
);

adminRouter.get(
  '/auth/session',
  asyncRoute(async (req, res) => {
    const cookies = readCookies(req);
    const username = await resolveSession(cookies[SESSION_COOKIE]);
    res.json({ username });
  }),
);

adminRouter.post(
  '/auth/logout',
  requireAdminSession,
  requireCsrf,
  asyncRoute(async (req: AuthedRequest, res) => {
    const cookies = readCookies(req);
    await destroySession(cookies[SESSION_COOKIE]);
    clearAuthCookies(res);
    await recordAuditLog({
      admin: req.adminUsername ?? 'unknown',
      action: 'logout',
      targetType: 'session',
      targetId: req.adminUsername ?? 'unknown',
      ip: clientIp(req),
    });
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// 아래부터는 세션 + CSRF 필수
// ---------------------------------------------------------------------------
adminRouter.use(requireAdminSession, requireCsrf);

function audit(
  req: AuthedRequest,
  action: string,
  targetType: string,
  targetId: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  return recordAuditLog({
    admin: req.adminUsername ?? 'unknown',
    action,
    targetType,
    targetId,
    before,
    after,
    ip: clientIp(req),
  });
}

// --- 부스 ---

adminRouter.get(
  '/booths',
  asyncRoute(async (_req, res) => {
    res.json((await loadData()).booths);
  }),
);

adminRouter.post(
  '/booths',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const input = parseBoothInput(req.body);
    if (input.imagePath) assertBoothImageExists(input.imagePath);
    const booth: Booth = { id: randomUUID(), ...input, archivedAt: null };
    await mutate<void>((current) => [{ ...current, booths: [...current.booths, booth] }, undefined]);
    await audit(req, 'booth_create', 'booth', booth.id, null, booth);
    res.status(201).json(booth);
  }),
);

adminRouter.put(
  '/booths/:id',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const input = parseBoothInput(req.body);
    if (input.imagePath) assertBoothImageExists(input.imagePath);
    const { id } = req.params;
    let before: Booth | undefined;
    const booth = await mutate<Booth>((current) => {
      const index = findIndexOrThrow(current.booths, id, '부스');
      before = current.booths[index];
      const updated: Booth = { ...current.booths[index], ...input, id };
      const booths = [...current.booths];
      booths[index] = updated;
      return [{ ...current, booths }, updated];
    });
    await audit(req, 'booth_update', 'booth', id, before, booth);
    res.json(booth);
  }),
);

adminRouter.delete(
  '/booths/:id',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    let before: Booth | undefined;
    const booth = await mutate<Booth>((current) => {
      const index = findIndexOrThrow(current.booths, id, '부스');
      before = current.booths[index];
      const archived: Booth = { ...current.booths[index], archivedAt: new Date().toISOString(), isPublic: false };
      const booths = [...current.booths];
      booths[index] = archived;
      return [{ ...current, booths }, archived];
    });
    await audit(req, 'booth_archive', 'booth', id, before, booth);
    res.json(booth);
  }),
);

adminRouter.post(
  '/booths/:id/restore',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    let before: Booth | undefined;
    const booth = await mutate<Booth>((current) => {
      const index = findIndexOrThrow(current.booths, id, '부스');
      before = current.booths[index];
      const restored: Booth = { ...current.booths[index], archivedAt: null };
      const booths = [...current.booths];
      booths[index] = restored;
      return [{ ...current, booths }, restored];
    });
    await audit(req, 'booth_restore', 'booth', id, before, booth);
    res.json(booth);
  }),
);

// --- 공연 순서 ---

adminRouter.get(
  '/performances',
  asyncRoute(async (_req, res) => {
    res.json((await loadData()).shows);
  }),
);

adminRouter.post(
  '/performances',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const input = parseShowInput(req.body);
    const show = await mutate<Show>((current) => {
      const created: Show = { id: randomUUID(), order: current.shows.length + 1, ...input };
      return [{ ...current, shows: [...current.shows, created] }, created];
    });
    await audit(req, 'performance_create', 'performance', show.id, null, show);
    res.status(201).json(show);
  }),
);

adminRouter.put(
  '/performances/order',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const ids = parseIdList(req.body);
    const shows = await mutate<Show[]>((current) => {
      const byId = new Map(current.shows.map((show) => [show.id, show]));
      const ordered = ids.flatMap((id) => {
        const show = byId.get(id);
        if (!show) return [];
        byId.delete(id);
        return [show];
      });
      const next = renumberShows([...ordered, ...byId.values()]);
      return [{ ...current, shows: next }, next];
    });
    await audit(req, 'performance_reorder', 'performance', 'order', null, shows);
    res.json(shows);
  }),
);

adminRouter.put(
  '/performances/:id',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const input = parseShowInput(req.body);
    const { id } = req.params;
    let before: Show | undefined;
    const show = await mutate<Show>((current) => {
      const index = findIndexOrThrow(current.shows, id, '공연');
      before = current.shows[index];
      const updated: Show = { ...current.shows[index], id, ...input };
      const shows = [...current.shows];
      shows[index] = updated;
      return [{ ...current, shows }, updated];
    });
    await audit(req, 'performance_update', 'performance', id, before, show);
    res.json(show);
  }),
);

adminRouter.delete(
  '/performances/:id',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    let before: Show | undefined;
    await mutate<void>((current) => {
      const index = findIndexOrThrow(current.shows, id, '공연');
      before = current.shows[index];
      const shows = renumberShows(current.shows.filter((show) => show.id !== id));
      return [{ ...current, shows }, undefined];
    });
    await audit(req, 'performance_delete', 'performance', id, before, null);
    res.status(204).end();
  }),
);

// --- 축제 일정 ---

adminRouter.get(
  '/schedule',
  asyncRoute(async (_req, res) => {
    res.json((await loadData()).scheduleItems);
  }),
);

adminRouter.post(
  '/schedule',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const input = parseScheduleItemInput(req.body);
    const item = await mutate<ScheduleItem>((current) => {
      const created: ScheduleItem = { id: randomUUID(), ...input };
      return [{ ...current, scheduleItems: [...current.scheduleItems, created] }, created];
    });
    await audit(req, 'schedule_create', 'schedule', item.id, null, item);
    res.status(201).json(item);
  }),
);

adminRouter.put(
  '/schedule/:id',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const input = parseScheduleItemInput(req.body);
    const { id } = req.params;
    let before: ScheduleItem | undefined;
    const item = await mutate<ScheduleItem>((current) => {
      const index = findIndexOrThrow(current.scheduleItems, id, '일정');
      before = current.scheduleItems[index];
      const updated: ScheduleItem = { id, ...input };
      const scheduleItems = [...current.scheduleItems];
      scheduleItems[index] = updated;
      return [{ ...current, scheduleItems }, updated];
    });
    await audit(req, 'schedule_update', 'schedule', id, before, item);
    res.json(item);
  }),
);

adminRouter.delete(
  '/schedule/:id',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    let before: ScheduleItem | undefined;
    await mutate<void>((current) => {
      const index = findIndexOrThrow(current.scheduleItems, id, '일정');
      before = current.scheduleItems[index];
      return [{ ...current, scheduleItems: current.scheduleItems.filter((item) => item.id !== id) }, undefined];
    });
    await audit(req, 'schedule_delete', 'schedule', id, before, null);
    res.status(204).end();
  }),
);

// --- 공지 ---

adminRouter.get(
  '/announcements',
  asyncRoute(async (_req, res) => {
    res.json((await loadData()).announcements);
  }),
);

adminRouter.post(
  '/announcements',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const input = parseAnnouncementInput(req.body);
    const now = new Date().toISOString();
    const announcement = await mutate<Announcement>((current) => {
      const created: Announcement = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
      return [{ ...current, announcements: [...current.announcements, created] }, created];
    });
    await audit(req, 'announcement_create', 'announcement', announcement.id, null, announcement);
    res.status(201).json(announcement);
  }),
);

adminRouter.put(
  '/announcements/:id',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const input = parseAnnouncementInput(req.body);
    const { id } = req.params;
    let before: Announcement | undefined;
    const announcement = await mutate<Announcement>((current) => {
      const index = findIndexOrThrow(current.announcements, id, '공지');
      before = current.announcements[index];
      const updated: Announcement = {
        ...current.announcements[index],
        ...input,
        id,
        updatedAt: new Date().toISOString(),
      };
      const announcements = [...current.announcements];
      announcements[index] = updated;
      return [{ ...current, announcements }, updated];
    });
    await audit(req, 'announcement_update', 'announcement', id, before, announcement);
    res.json(announcement);
  }),
);

adminRouter.delete(
  '/announcements/:id',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    let before: Announcement | undefined;
    await mutate<void>((current) => {
      const index = findIndexOrThrow(current.announcements, id, '공지');
      before = current.announcements[index];
      return [
        { ...current, announcements: current.announcements.filter((item) => item.id !== id) },
        undefined,
      ];
    });
    await audit(req, 'announcement_delete', 'announcement', id, before, null);
    res.status(204).end();
  }),
);

// --- 기본 정보 / 설정 ---

adminRouter.get(
  '/meta',
  asyncRoute(async (_req, res) => {
    res.json((await loadData()).meta);
  }),
);

adminRouter.put(
  '/meta',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const meta = parseMetaInput(req.body);
    let before;
    const data = await mutate((current) => {
      before = current.meta;
      const next = { ...current, meta };
      return [next, next];
    });
    await audit(req, 'meta_update', 'meta', 'meta', before, meta);
    res.json(data);
  }),
);

adminRouter.get(
  '/settings',
  asyncRoute(async (_req, res) => {
    res.json((await loadData()).settings);
  }),
);

adminRouter.put(
  '/settings',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const settings = parseSettingsInput(req.body);
    let before;
    const data = await mutate((current) => {
      before = current.settings;
      const next = { ...current, settings };
      return [next, next];
    });
    await audit(req, 'settings_update', 'settings', 'settings', before, settings);
    res.json(data.settings);
  }),
);

// --- 순위 미리보기 (rankingsPublic 이 꺼져 있어도 운영자에게는 항상 보여준다) ---

adminRouter.get(
  '/rankings',
  asyncRoute(async (_req, res) => {
    const data = await loadData();
    res.json({ rankingsPublic: data.settings.rankingsPublic, rankings: rankBooths(visibleBooths(data)) });
  }),
);

// --- 소개 콘텐츠 (HANWOL-INTRO-V1) ---
// 초안/게시 분리는 이 landing 상태에만 적용된다. 부스·공연·일정·공지는 기존 CRUD 흐름을 그대로 쓴다.

adminRouter.get(
  '/landing',
  asyncRoute(async (_req, res) => {
    res.json((await loadData()).landing);
  }),
);

adminRouter.put(
  '/landing',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const expectedRevision = readExpectedRevision(req.body);
    const content = parseLandingContent((req.body as { content?: unknown } | null)?.content);
    let before: LandingState | undefined;
    const landing = await mutate<LandingState>((current) => {
      before = current.landing;
      if (current.landing.revision !== expectedRevision) {
        throw new HttpError(409, '다른 곳에서 먼저 저장되어 최신 내용과 다릅니다. 새로 불러온 뒤 다시 시도해 주세요.');
      }
      const next: LandingState = { ...current.landing, draft: content, revision: current.landing.revision + 1 };
      return [{ ...current, landing: next }, next];
    });
    await audit(req, 'landing_draft_save', 'landing', 'landing', before?.draft, content);
    res.json(landing);
  }),
);

adminRouter.post(
  '/landing/publish',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const expectedRevision = readExpectedRevision(req.body);
    let before: LandingState | undefined;
    const landing = await mutate<LandingState>((current) => {
      before = current.landing;
      if (current.landing.revision !== expectedRevision) {
        throw new HttpError(409, '다른 곳에서 먼저 저장되어 최신 내용과 다릅니다. 새로 불러온 뒤 다시 시도해 주세요.');
      }
      // 저장된 draft를 다시 검증한 뒤 깊은 복사하여 published로 옮긴다 (draft를 참조로 공유하지 않는다).
      const validated = parseLandingContent(current.landing.draft);
      const next: LandingState = {
        ...current.landing,
        published: JSON.parse(JSON.stringify(validated)),
        publishedAt: new Date().toISOString(),
        revision: current.landing.revision + 1,
      };
      return [{ ...current, landing: next }, next];
    });
    await audit(req, 'landing_publish', 'landing', 'landing', before?.published, landing.published);
    res.json(landing);
  }),
);

// --- 감사 로그 ---

adminRouter.get(
  '/audit-logs',
  asyncRoute(async (req, res) => {
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 200));
    res.json(await listAuditLogs(limit));
  }),
);

// --- 관리자 계정 (조회만, 생성은 CLI 전용) ---

adminRouter.get(
  '/me',
  asyncRoute(async (req: AuthedRequest, res: Response) => {
    const data = await loadAdminData();
    const user = data.adminUsers.find((candidate) => candidate.username === req.adminUsername);
    res.json({ username: req.adminUsername, lastLoginAt: user?.lastLoginAt ?? null });
  }),
);
