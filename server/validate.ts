import { randomUUID } from 'node:crypto';
import {
  DEFAULT_BOOTH_SIZE,
  defaultFloorPlan,
  defaultFloorPlans,
  FLOOR_IDS,
  MAX_ROOMS_PER_FLOOR,
  MIN_BOOTH_SIZE,
  MIN_ROOM_SIZE,
  ROOM_TONES,
  roundPercent,
} from '../shared/floorPlans.js';
import type {
  Announcement,
  AnnouncementInput,
  Booth,
  BoothInput,
  BoothSize,
  FaqItem,
  FestivalData,
  FestivalMeta,
  FestivalSettings,
  FloorId,
  FloorPlanDef,
  FloorPlanInput,
  FloorRoom,
  LandingContent,
  LandingState,
  ScheduleItem,
  ScheduleItemInput,
  Show,
  ShowInput,
} from '../shared/types.js';
import { isWellFormedBoothImagePath } from './assets.js';
import { createParentBooth, createSeedData, createSeedLandingState, CURRENT_DATA_VERSION, PARENT_BOOTH_ID } from './seed.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const FLOORS: FloorId[] = [...FLOOR_IDS];

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpError(400, `${label} 값이 올바르지 않습니다.`);
  }
  return value as Record<string, unknown>;
}

function requireText(value: unknown, label: string, max = 80): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, `${label}을(를) 입력해 주세요.`);
  }
  const text = value.trim();
  if (text.length > max) throw new HttpError(400, `${label}은(는) ${max}자 이하로 입력해 주세요.`);
  return text;
}

function optionalText(value: unknown, label: string, max = 80): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requireText(value, label, max);
}

/** allowNegative: 부스 모금액은 시작 준비금(-100,000원 등) 때문에 음수에서 출발할 수 있다. */
/** 빈 항목은 버리고, 하나도 남지 않으면 undefined (optionalText 와 같은 규칙). */
function optionalTextList(value: unknown, label: string, maxItems: number, max = 80): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const items = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(items)) {
    throw new HttpError(400, `${label} 값이 올바르지 않습니다.`);
  }
  const list = items.flatMap((item) => {
    const text = typeof item === 'string' && item.trim() === '' ? undefined : optionalText(item, label, max);
    return text ? [text] : [];
  });
  if (list.length > maxItems) {
    throw new HttpError(400, `${label}은(는) 최대 ${maxItems}개까지 입력할 수 있습니다.`);
  }
  return list.length > 0 ? list : undefined;
}

function requireAmount(value: unknown, label: string, allowNegative = false): number {
  const num = typeof value === 'string' ? Number(value.replace(/[,\s]/g, '')) : value;
  if (typeof num !== 'number' || !Number.isFinite(num)) {
    throw new HttpError(400, `${label}은(는) 숫자여야 합니다.`);
  }
  if (!allowNegative && num < 0) {
    throw new HttpError(400, `${label}은(는) 0 이상의 숫자여야 합니다.`);
  }
  return Math.round(num);
}

function requirePercent(value: unknown, label: string): number {
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num)) {
    throw new HttpError(400, `${label}은(는) 숫자여야 합니다.`);
  }
  return Math.min(100, Math.max(0, Math.round(num * 10) / 10));
}

function requireFloor(value: unknown): FloorId {
  const num = typeof value === 'string' ? Number(value) : value;
  if (!FLOORS.includes(num as FloorId)) {
    throw new HttpError(400, `층은 ${FLOORS.join(', ')} 중 하나여야 합니다.`);
  }
  return num as FloorId;
}

/** 라우트가 URL 파라미터(":floor")를 층 번호로 바꿀 때 쓴다. */
export function parseFloorParam(value: unknown): FloorId {
  return requireFloor(value);
}

function requireTime(value: unknown): string {
  const text = requireText(value, '시간', 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
    throw new HttpError(400, '시간은 HH:MM 형식으로 입력해 주세요.');
  }
  return text;
}

function requireBool(value: unknown, label: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new HttpError(400, `${label}은(는) true/false 값이어야 합니다.`);
  return value;
}

/** 값이 없거나 빈 문자열이면 ''(미입력)을 허용하는 자유 텍스트. 자유 HTML은 저장하지 않으므로 이스케이프는 렌더링 쪽에서 담당한다. */
function optionalLongText(value: unknown, label: string, max: number): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw new HttpError(400, `${label} 값이 올바르지 않습니다.`);
  if (value.length > max) throw new HttpError(400, `${label}은(는) ${max}자 이하로 입력해 주세요.`);
  return value;
}

/** 형식만 검사한다 (외부 URL/data:/경로 탈출 차단). 파일 존재 여부는 라우트에서 별도로 확인한다. */
function optionalImagePathFormat(value: unknown, label: string): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || !isWellFormedBoothImagePath(value)) {
    throw new HttpError(400, `${label}은(는) /booth-images/ 아래의 png·jpg·jpeg·webp·svg 파일 경로여야 합니다.`);
  }
  return value;
}

/**
 * 부스 영역 크기(%)를 읽는다. 값이 없으면 기본 크기를 쓴다 (size 필드가 없던 기존 데이터 호환).
 * 상한을 100으로 잡고, 중심 좌표와 합쳐 배치도 밖으로 못 나가게 하는 일은 clampBoothGeometry 가 맡는다.
 */
function parseBoothSize(value: unknown): BoothSize {
  if (value === undefined || value === null) return { ...DEFAULT_BOOTH_SIZE };
  const raw = asRecord(value, '부스 크기');
  const w = requirePercent(raw.w, '부스 너비');
  const h = requirePercent(raw.h, '부스 높이');
  return {
    w: Math.min(100, Math.max(MIN_BOOTH_SIZE.w, w)),
    h: Math.min(100, Math.max(MIN_BOOTH_SIZE.h, h)),
  };
}

/** 부스 영역(중심 + 크기)이 배치도(0~100%) 안에 완전히 들어오도록 중심 좌표를 민다. */
function clampBoothGeometry(position: { x: number; y: number }, size: BoothSize) {
  const half = { x: size.w / 2, y: size.h / 2 };
  return {
    position: {
      x: Math.round(Math.min(100 - half.x, Math.max(half.x, position.x)) * 10) / 10,
      y: Math.round(Math.min(100 - half.y, Math.max(half.y, position.y)) * 10) / 10,
    },
    size,
  };
}

export function parseBoothInput(body: unknown): BoothInput {
  const raw = asRecord(body, '부스');
  const position = asRecord(raw.position ?? {}, '위치');
  const imagePath = optionalImagePathFormat(raw.imagePath, '이미지 경로');
  const imageAlt = optionalText(raw.imageAlt, '이미지 대체 텍스트', 200) ?? '';
  if (imagePath && !imageAlt) {
    throw new HttpError(400, '이미지를 사용하려면 대체 텍스트를 입력해 주세요.');
  }
  const geometry = clampBoothGeometry(
    { x: requirePercent(position.x, '위치 X'), y: requirePercent(position.y, '위치 Y') },
    parseBoothSize(raw.size),
  );
  return {
    name: requireText(raw.name, '부스명', 40),
    team: requireText(raw.team, '팀/학급명', 40),
    floor: requireFloor(raw.floor),
    amount: requireAmount(raw.amount, '모금액', true),
    place: optionalText(raw.place, '위치 설명', 40),
    position: geometry.position,
    size: geometry.size,
    isActive: requireBool(raw.isActive, '운영 상태', true),
    isPublic: requireBool(raw.isPublic, '공개 여부', true),
    summary: optionalText(raw.summary, '부스 소개 요약', 300) ?? '',
    description: optionalLongText(raw.description, '부스 상세 설명', 3000),
    imagePath,
    imageAlt,
  };
}

export function parseShowInput(body: unknown): Omit<ShowInput, 'order'> {
  const raw = asRecord(body, '공연');
  return {
    time: requireTime(raw.time),
    team: requireText(raw.team, '팀/학급명', 40),
    title: requireText(raw.title, '공연 내용', 60),
    // songTitle(단일 문자열)은 곡명 목록 도입 전 형식 — 저장 데이터·이전 요청을 그대로 받는다.
    songTitles: optionalTextList(raw.songTitles ?? raw.songTitle, '곡명', 10, 80),
    genre: optionalText(raw.genre, '장르', 20),
    note: optionalText(raw.note, '비고', 60),
  };
}

export function parseScheduleItemInput(body: unknown): ScheduleItemInput {
  const raw = asRecord(body, '일정');
  return {
    time: requireTime(raw.time),
    title: requireText(raw.title, '일정명', 60),
    note: optionalText(raw.note, '비고', 80),
  };
}

export function parseAnnouncementInput(body: unknown): AnnouncementInput {
  const raw = asRecord(body, '공지');
  return {
    title: requireText(raw.title, '제목', 80),
    body: requireText(raw.body, '내용', 2000),
    isPublished: requireBool(raw.isPublished, '게시 여부', false),
  };
}

export function parseSettingsInput(body: unknown): FestivalSettings {
  const raw = asRecord(body, '설정');
  return {
    rankingsPublic: requireBool(raw.rankingsPublic, '순위 공개 여부', true),
  };
}

export function parseMetaInput(body: unknown): FestivalMeta {
  const raw = asRecord(body, '기본 정보');
  return {
    updated: optionalText(raw.updated, '갱신 시각', 40) ?? '',
    goal: requireAmount(raw.goal ?? 0, '목표 금액'),
    stage: optionalText(raw.stage, '공연 장소', 30) ?? '',
  };
}

// ---------------------------------------------------------------------------
// 층 배치도 (교실/복도/계단 칸)
// ---------------------------------------------------------------------------

/** 칸 하나가 배치도(0~100%) 안에 완전히 들어오도록 크기를 먼저 줄이고 위치를 민다. */
function clampRoomGeometry(room: { x: number; y: number; w: number; h: number }) {
  const w = Math.min(100, Math.max(MIN_ROOM_SIZE.w, room.w));
  const h = Math.min(100, Math.max(MIN_ROOM_SIZE.h, room.h));
  return {
    x: roundPercent(Math.min(100 - w, Math.max(0, room.x))),
    y: roundPercent(Math.min(100 - h, Math.max(0, room.y))),
    w: roundPercent(w),
    h: roundPercent(h),
  };
}

function requireRoomTone(value: unknown): FloorRoom['tone'] {
  if (typeof value !== 'string' || !ROOM_TONES.includes(value as FloorRoom['tone'])) {
    throw new HttpError(400, `칸 종류는 ${ROOM_TONES.join(', ')} 중 하나여야 합니다.`);
  }
  return value as FloorRoom['tone'];
}

function parseFloorRoom(value: unknown, floor: FloorId, index: number, usedIds: Set<string>): FloorRoom {
  const raw = asRecord(value, `${floor}층 ${index + 1}번 칸`);
  const geometry = clampRoomGeometry({
    x: requirePercent(raw.x, '칸 X'),
    y: requirePercent(raw.y, '칸 Y'),
    w: requirePercent(raw.w, '칸 너비'),
    h: requirePercent(raw.h, '칸 높이'),
  });
  // id 는 화면에서 key 로만 쓰이므로, 비었거나 겹치면 서버가 새로 만들어 준다.
  const requested = typeof raw.id === 'string' ? raw.id.trim().slice(0, 60) : '';
  const id = requested && !usedIds.has(requested) ? requested : `${floor}-room-${index}-${randomUUID().slice(0, 8)}`;
  usedIds.add(id);
  return {
    id,
    label: requireText(raw.label, '칸 이름', 40),
    ...geometry,
    tone: requireRoomTone(raw.tone),
  };
}

/** 관리자가 보낸 한 층의 배치도. id 는 URL 로 받으므로 본문 값은 무시한다. */
export function parseFloorPlanInput(body: unknown, floor: FloorId): FloorPlanInput {
  const raw = asRecord(body, '층 배치도');
  const rooms = raw.rooms;
  if (!Array.isArray(rooms)) throw new HttpError(400, '칸 목록이 올바르지 않습니다.');
  if (rooms.length > MAX_ROOMS_PER_FLOOR) {
    throw new HttpError(400, `한 층에는 칸을 최대 ${MAX_ROOMS_PER_FLOOR}개까지 둘 수 있습니다.`);
  }
  const usedIds = new Set<string>();
  return {
    label: requireText(raw.label, '층 이름', 20),
    hint: optionalText(raw.hint, '층 설명', 60) ?? '',
    rooms: rooms.map((room, index) => parseFloorRoom(room, floor, index, usedIds)),
  };
}

/**
 * 저장 파일의 배치도를 보정한다.
 * - 값이 깨졌으면 그 층만 기본값으로 되돌린다 (다른 층 편집 결과는 살린다).
 * - 파일에 없는 층(새로 추가된 4층 등)은 기본값으로 채운다 — 기존 배포도 재배포만으로 새 층이 생긴다.
 */
export function normalizeFloorPlans(value: unknown): FloorPlanDef[] {
  if (!Array.isArray(value)) return defaultFloorPlans();
  const stored = new Map<FloorId, unknown>();
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const id = (item as { id?: unknown }).id;
    if (FLOORS.includes(id as FloorId)) stored.set(id as FloorId, item);
  }
  return FLOORS.map((id) => {
    const raw = stored.get(id);
    if (raw === undefined) return defaultFloorPlan(id);
    try {
      return { id, ...parseFloorPlanInput(raw, id) };
    } catch {
      return defaultFloorPlan(id);
    }
  });
}

// ---------------------------------------------------------------------------
// 소개 콘텐츠 (HANWOL-INTRO-V1) — 관리자 요구사항2.md와 동일한 계약을 따른다.
// ---------------------------------------------------------------------------

const HTTPS_URL_RE = /^https:\/\/\S+$/;
// 시간대 오프셋을 포함한 ISO 8601 (예: 2026-10-09T13:00:00+09:00 또는 ...Z)
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

function requirePositiveInt(value: unknown, label: string): number {
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isInteger(num) || num <= 0) {
    throw new HttpError(400, `${label}은(는) 1 이상의 정수여야 합니다.`);
  }
  return num;
}

function requireYear(value: unknown, label: string): number {
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isInteger(num) || num < 2000 || num > 2100) {
    throw new HttpError(400, `${label}은(는) 2000~2100 사이의 정수여야 합니다.`);
  }
  return num;
}

function optionalHttpsUrl(value: unknown, label: string): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || !HTTPS_URL_RE.test(value)) {
    throw new HttpError(400, `${label}은(는) https:// 로 시작하는 URL이어야 합니다.`);
  }
  return value;
}

function optionalIsoDateTime(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !ISO_DATETIME_RE.test(value)) {
    throw new HttpError(400, `${label}은(는) 시간대 오프셋을 포함한 ISO 날짜 형식이거나 비워 두어야 합니다.`);
  }
  return value;
}

function parseFaqItems(value: unknown): FaqItem[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, 'FAQ 목록이 올바르지 않습니다.');
  if (value.length > 20) throw new HttpError(400, 'FAQ는 최대 20개까지 등록할 수 있습니다.');
  return value.map((item, index) => {
    const raw = asRecord(item, `FAQ ${index + 1}`);
    return {
      id: typeof raw.id === 'string' && raw.id.trim() !== '' ? raw.id : `faq-${index + 1}-${Date.now()}`,
      question: requireText(raw.question, `FAQ ${index + 1} 질문`, 200),
      answer: requireText(raw.answer, `FAQ ${index + 1} 답변`, 2000),
    };
  });
}

export function parseLandingContent(body: unknown): LandingContent {
  const raw = asRecord(body, '소개 콘텐츠');
  const startsAt = optionalIsoDateTime(raw.startsAt, '시작 시각');
  const endsAt = optionalIsoDateTime(raw.endsAt, '종료 시각');
  if (startsAt && endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
    throw new HttpError(400, '종료 시각은 시작 시각 이후여야 합니다.');
  }
  return {
    festivalName: requireText(raw.festivalName, '행사명', 80),
    edition: requirePositiveInt(raw.edition, '회차'),
    year: requireYear(raw.year, '연도'),
    theme: requireText(raw.theme, '주제', 80),
    heroTitle: requireText(raw.heroTitle, '첫 화면 제목', 120),
    heroDescription: optionalLongText(raw.heroDescription, '첫 화면 소개', 500),
    startsAt,
    endsAt,
    venueName: optionalLongText(raw.venueName, '장소명', 120),
    address: optionalLongText(raw.address, '주소', 300),
    directionsUrl: optionalHttpsUrl(raw.directionsUrl, '지도 링크'),
    themeTitle: optionalLongText(raw.themeTitle, '주제 소개 제목', 120),
    themeBody: optionalLongText(raw.themeBody, '주제 소개 본문', 3000),
    audienceInfo: optionalLongText(raw.audienceInfo, '참여 대상 안내', 1000),
    admissionInfo: optionalLongText(raw.admissionInfo, '입장 안내', 1000),
    paymentInfo: optionalLongText(raw.paymentInfo, '결제 안내', 1000),
    operatingHoursInfo: optionalLongText(raw.operatingHoursInfo, '운영 시간 안내', 1000),
    contactInfo: optionalLongText(raw.contactInfo, '문의 안내', 1000),
    organizerText: optionalLongText(raw.organizerText, '주최 표기', 300),
    creditsText: optionalLongText(raw.creditsText, '제작진 표기', 300),
    faqItems: parseFaqItems(raw.faqItems),
  };
}

/** 저장 파일에 landing이 없거나 일부가 깨져 있어도 안전한 기본값으로 보완한다 (다시 실행해도 중복되지 않는다). */
export function normalizeLandingState(value: unknown): LandingState {
  const seed = createSeedLandingState();
  if (typeof value !== 'object' || value === null) return seed;
  const raw = value as Partial<LandingState>;

  const draft = (() => {
    try {
      return parseLandingContent(raw.draft ?? seed.draft);
    } catch {
      return seed.draft;
    }
  })();

  const published = (() => {
    if (raw.published === undefined || raw.published === null) return null;
    try {
      return parseLandingContent(raw.published);
    } catch {
      return null;
    }
  })();

  const revision =
    typeof raw.revision === 'number' && Number.isInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0;
  const publishedAt = published && typeof raw.publishedAt === 'string' ? raw.publishedAt : null;

  return { revision, draft, published, publishedAt };
}

export function parseIdList(body: unknown): string[] {
  const raw = asRecord(body, '순서');
  const ids = raw.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    throw new HttpError(400, '순서 목록이 올바르지 않습니다.');
  }
  return ids as string[];
}

/**
 * 저장 파일에 한 번만 적용되는 데이터 마이그레이션.
 *
 * 기존 데이터를 지우거나 덮어쓰지 않고 "빠진 것만 채우는" 방향으로만 동작해야 한다.
 * 모두 멱등이라 여러 번 실행해도 결과가 같다.
 */
function applyMigrations(data: FestivalData, storedVersion: number): FestivalData {
  let next = data;

  // v1: 3층 지능형소프트웨어과 교실 앞 학부모 부스 추가.
  // 이미 같은 id 가 있으면(보관 처리 포함) 건드리지 않는다 — 운영자가 지운 부스를 되살리지 않기 위함.
  if (storedVersion < 1 && !next.booths.some((booth) => booth.id === PARENT_BOOTH_ID)) {
    next = { ...next, booths: [...next.booths, createParentBooth()] };
  }

  return { ...next, dataVersion: CURRENT_DATA_VERSION };
}

/** 저장 파일이 오래된 형식이거나 일부 필드가 빠져 있어도 앱이 뜨도록 보정한다. */
export function normalizeFestivalData(value: unknown): FestivalData {
  const seed = createSeedData();
  const raw = asRecord(value, '저장 데이터');
  const storedVersion = typeof raw.dataVersion === 'number' && raw.dataVersion >= 0 ? raw.dataVersion : 0;
  const metaRaw = (raw.meta ?? {}) as Partial<FestivalMeta>;
  const booths = Array.isArray(raw.booths) ? raw.booths : [];
  const shows = Array.isArray(raw.shows) ? raw.shows : [];
  const scheduleItems = Array.isArray(raw.scheduleItems) ? raw.scheduleItems : [];
  const announcements = Array.isArray(raw.announcements) ? raw.announcements : [];

  const normalized: FestivalData = {
    dataVersion: storedVersion,
    meta: {
      updated: typeof metaRaw.updated === 'string' ? metaRaw.updated : seed.meta.updated,
      goal: typeof metaRaw.goal === 'number' && metaRaw.goal >= 0 ? metaRaw.goal : 0,
      stage: typeof metaRaw.stage === 'string' ? metaRaw.stage : seed.meta.stage,
    },
    settings: (() => {
      try {
        return parseSettingsInput(raw.settings ?? {});
      } catch {
        return { rankingsPublic: true };
      }
    })(),
    landing: normalizeLandingState(raw.landing),
    floorPlans: normalizeFloorPlans(raw.floorPlans),
    booths: booths.flatMap((item, index): Booth[] => {
      try {
        const record = asRecord(item, '부스');
        const input = parseBoothInput(record);
        return [
          {
            id: typeof record.id === 'string' ? record.id : `booth-${index + 1}`,
            ...input,
            archivedAt: typeof record.archivedAt === 'string' ? record.archivedAt : null,
          },
        ];
      } catch {
        return [];
      }
    }),
    shows: shows
      .flatMap((item, index): Show[] => {
        try {
          const record = asRecord(item, '공연');
          const input = parseShowInput(record);
          return [
            {
              id: typeof record.id === 'string' ? record.id : `show-${index + 1}`,
              order: typeof record.order === 'number' ? record.order : index + 1,
              ...input,
            },
          ];
        } catch {
          return [];
        }
      })
      .sort((a, b) => a.order - b.order)
      .map((show, index) => ({ ...show, order: index + 1 })),
    scheduleItems: scheduleItems.flatMap((item, index): ScheduleItem[] => {
      try {
        const record = asRecord(item, '일정');
        const input = parseScheduleItemInput(record);
        return [{ id: typeof record.id === 'string' ? record.id : `schedule-${index + 1}`, ...input }];
      } catch {
        return [];
      }
    }),
    announcements: announcements.flatMap((item, index): Announcement[] => {
      try {
        const record = asRecord(item, '공지');
        const input = parseAnnouncementInput(record);
        const now = new Date().toISOString();
        return [
          {
            id: typeof record.id === 'string' ? record.id : `announcement-${index + 1}`,
            ...input,
            createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
            updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now,
          },
        ];
      } catch {
        return [];
      }
    }),
  };

  return applyMigrations(normalized, storedVersion);
}
