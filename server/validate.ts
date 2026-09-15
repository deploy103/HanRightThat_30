import type {
  Announcement,
  AnnouncementInput,
  Booth,
  BoothInput,
  FestivalData,
  FestivalMeta,
  FestivalSettings,
  FloorId,
  ScheduleItem,
  ScheduleItemInput,
  Show,
  ShowInput,
} from '../shared/types.js';
import { createSeedData } from './seed.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const FLOORS: FloorId[] = [2, 3];

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

function requireAmount(value: unknown, label: string): number {
  const num = typeof value === 'string' ? Number(value.replace(/[,\s]/g, '')) : value;
  if (typeof num !== 'number' || !Number.isFinite(num) || num < 0) {
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
  if (num !== 2 && num !== 3) throw new HttpError(400, '층은 2 또는 3이어야 합니다.');
  return num;
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

export function parseBoothInput(body: unknown): BoothInput {
  const raw = asRecord(body, '부스');
  const position = asRecord(raw.position ?? {}, '위치');
  return {
    name: requireText(raw.name, '부스명', 40),
    team: requireText(raw.team, '팀/학급명', 40),
    floor: requireFloor(raw.floor),
    amount: requireAmount(raw.amount, '모금액'),
    place: optionalText(raw.place, '위치 설명', 40),
    position: {
      x: requirePercent(position.x, '위치 X'),
      y: requirePercent(position.y, '위치 Y'),
    },
    isActive: requireBool(raw.isActive, '운영 상태', true),
    isPublic: requireBool(raw.isPublic, '공개 여부', true),
  };
}

export function parseShowInput(body: unknown): Omit<ShowInput, 'order'> {
  const raw = asRecord(body, '공연');
  return {
    time: requireTime(raw.time),
    team: requireText(raw.team, '팀/학급명', 40),
    title: requireText(raw.title, '공연명', 60),
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

export function parseIdList(body: unknown): string[] {
  const raw = asRecord(body, '순서');
  const ids = raw.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    throw new HttpError(400, '순서 목록이 올바르지 않습니다.');
  }
  return ids as string[];
}

/** 저장 파일이 오래된 형식이거나 일부 필드가 빠져 있어도 앱이 뜨도록 보정한다. */
export function normalizeFestivalData(value: unknown): FestivalData {
  const seed = createSeedData();
  const raw = asRecord(value, '저장 데이터');
  const metaRaw = (raw.meta ?? {}) as Partial<FestivalMeta>;
  const booths = Array.isArray(raw.booths) ? raw.booths : [];
  const shows = Array.isArray(raw.shows) ? raw.shows : [];
  const scheduleItems = Array.isArray(raw.scheduleItems) ? raw.scheduleItems : [];
  const announcements = Array.isArray(raw.announcements) ? raw.announcements : [];

  return {
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
}
