import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as DbModule from './db.js';
import type { FestivalData } from '../shared/types.js';

let dir: string;
let db: typeof DbModule;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hanbit-test-'));
  process.env.FESTIVAL_DB = join(dir, 'festival.json');
  // 환경변수를 세팅한 뒤에 모듈을 읽어야 테스트용 경로가 적용된다.
  db = await import('./db.js');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.FESTIVAL_DB;
});

describe('영속 저장', () => {
  it('최초 실행 시 기본 부스 9개(2층 4 + 3층 5)로 시드한다', async () => {
    const data = await db.loadData();
    expect(data.booths).toHaveLength(9);
    expect(data.booths.filter((booth) => booth.floor === 2)).toHaveLength(4);
    // 3층은 기본 4개 + 학부모 부스.
    expect(data.booths.filter((booth) => booth.floor === 3)).toHaveLength(5);
    expect(data.booths.some((booth) => booth.name === '학부모 부스')).toBe(true);
  });

  it('변경 내용이 파일에 저장되어 재시작 후에도 유지된다', async () => {
    await db.mutate<void>((current: FestivalData) => [
      {
        ...current,
        booths: [
          ...current.booths,
          {
            id: 'booth-test',
            name: '테스트 부스',
            team: '검증팀',
            floor: 3,
            amount: 12345,
            position: { x: 10, y: 20 },
            isActive: true,
            isPublic: true,
            archivedAt: null,
          },
        ],
      },
      undefined,
    ]);

    // 메모리 캐시를 비우면 재시작과 동일하게 파일에서 다시 읽는다.
    db.resetCache();
    const reloaded = await db.loadData();
    const saved = reloaded.booths.find((booth) => booth.id === 'booth-test');
    expect(saved?.amount).toBe(12345);
    expect(reloaded.booths).toHaveLength(10);
  });
});

describe('소개 콘텐츠(landing) 영속성', () => {
  it('최초 실행 시 draft는 시드값, published는 null이다', async () => {
    const data = await db.loadData();
    expect(data.landing.revision).toBe(0);
    expect(data.landing.published).toBeNull();
    expect(data.landing.draft.festivalName).toBe('한빛제');
  });

  it('초안 저장은 draft만 바꾸고 published는 그대로 둔다 (재시작 후에도 유지)', async () => {
    await db.mutate<void>((current: FestivalData) => [
      {
        ...current,
        landing: {
          ...current.landing,
          draft: { ...current.landing.draft, heroTitle: '수정된 제목' },
          revision: current.landing.revision + 1,
        },
      },
      undefined,
    ]);

    db.resetCache();
    const reloaded = await db.loadData();
    expect(reloaded.landing.draft.heroTitle).toBe('수정된 제목');
    expect(reloaded.landing.published).toBeNull();
    expect(reloaded.landing.revision).toBe(1);
  });

  it('게시하면 published가 draft의 깊은 복사본이 되어 이후 draft 변경에 영향받지 않는다', async () => {
    await db.mutate<void>((current: FestivalData) => [
      {
        ...current,
        landing: {
          ...current.landing,
          published: JSON.parse(JSON.stringify(current.landing.draft)),
          publishedAt: new Date().toISOString(),
          revision: current.landing.revision + 1,
        },
      },
      undefined,
    ]);
    await db.mutate<void>((current: FestivalData) => [
      { ...current, landing: { ...current.landing, draft: { ...current.landing.draft, heroTitle: '또 수정' } } },
      undefined,
    ]);

    db.resetCache();
    const reloaded = await db.loadData();
    expect(reloaded.landing.published?.heroTitle).toBe('수정된 제목');
    expect(reloaded.landing.draft.heroTitle).toBe('또 수정');
  });
});
