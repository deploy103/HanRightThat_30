import { describe, expect, it } from 'vitest';
import { DEFAULT_BOOTH_SIZE } from '../shared/floorPlans.js';
import { createSeedData, CURRENT_DATA_VERSION, PARENT_BOOTH_ID } from './seed.js';
import { normalizeFestivalData } from './validate.js';

/** 2FA/지도 개편 이전에 저장돼 있던 파일 모양 (dataVersion·size 없음). */
function legacyData() {
  return {
    meta: { updated: '9월 8일 오후 3시 기준', goal: 0, stage: '대강당' },
    settings: { rankingsPublic: true },
    booths: [
      {
        id: 'booth-old',
        name: '기존 부스',
        team: '2학년 3반',
        floor: 2,
        amount: 12345,
        place: '2층 복도',
        position: { x: 61.5, y: 33 },
        isActive: true,
        isPublic: true,
        archivedAt: null,
      },
    ],
    shows: [],
    scheduleItems: [],
    announcements: [],
  };
}

describe('데이터 마이그레이션', () => {
  it('기존 부스 데이터를 그대로 유지한다', () => {
    const result = normalizeFestivalData(legacyData());
    const old = result.booths.find((booth) => booth.id === 'booth-old');
    expect(old).toMatchObject({
      name: '기존 부스',
      amount: 12345,
      position: { x: 61.5, y: 33 },
    });
  });

  it('size 가 없던 부스에는 기본 크기를 채워 준다', () => {
    const result = normalizeFestivalData(legacyData());
    expect(result.booths.find((booth) => booth.id === 'booth-old')?.size).toEqual(DEFAULT_BOOTH_SIZE);
  });

  it('학부모 부스를 3층에 추가하고 dataVersion 을 올린다', () => {
    const result = normalizeFestivalData(legacyData());
    const parents = result.booths.find((booth) => booth.id === PARENT_BOOTH_ID);
    expect(parents).toBeDefined();
    expect(parents?.name).toBe('학부모 부스');
    expect(parents?.floor).toBe(3);
    expect(parents?.place).toBe('3층 지능형소프트웨어과 1-1 앞');
    expect(result.dataVersion).toBe(CURRENT_DATA_VERSION);
  });

  it('여러 번 실행해도 학부모 부스가 중복 생성되지 않는다', () => {
    const once = normalizeFestivalData(legacyData());
    const twice = normalizeFestivalData(JSON.parse(JSON.stringify(once)));
    expect(twice.booths.filter((booth) => booth.id === PARENT_BOOTH_ID)).toHaveLength(1);
  });

  it('운영자가 보관(archive)한 학부모 부스를 되살리지 않는다', () => {
    const migrated = normalizeFestivalData(legacyData());
    const archived = {
      ...migrated,
      booths: migrated.booths.map((booth) =>
        booth.id === PARENT_BOOTH_ID ? { ...booth, archivedAt: '2026-09-19T00:00:00+09:00', isPublic: false } : booth,
      ),
    };
    const result = normalizeFestivalData(JSON.parse(JSON.stringify(archived)));
    const parents = result.booths.filter((booth) => booth.id === PARENT_BOOTH_ID);
    expect(parents).toHaveLength(1);
    expect(parents[0].archivedAt).toBe('2026-09-19T00:00:00+09:00');
  });
});

describe('학부모 부스 배치', () => {
  it('3층 지능형소프트웨어과(가장 왼쪽 교실) 앞 복도 안에 들어간다', () => {
    const booth = createSeedData().booths.find((candidate) => candidate.id === PARENT_BOOTH_ID);
    expect(booth).toBeDefined();
    const size = booth?.size ?? DEFAULT_BOOTH_SIZE;
    const left = (booth?.position.x ?? 0) - size.w / 2;
    const right = (booth?.position.x ?? 0) + size.w / 2;
    const top = (booth?.position.y ?? 0) - size.h / 2;
    const bottom = (booth?.position.y ?? 0) + size.h / 2;

    // 복도 영역: x 10~90, y 64~94
    expect(left).toBeGreaterThanOrEqual(10);
    expect(right).toBeLessThanOrEqual(90);
    expect(top).toBeGreaterThanOrEqual(64);
    expect(bottom).toBeLessThanOrEqual(94);

    // 가장 왼쪽 교실(x 10~29) 바로 앞이어야 한다.
    expect(right).toBeLessThanOrEqual(29);
  });
});

describe('부스 영역 검증', () => {
  it('배치도 밖을 가리키는 좌표는 안쪽으로 보정해서 저장한다', () => {
    const result = normalizeFestivalData({
      ...legacyData(),
      booths: [
        {
          ...legacyData().booths[0],
          position: { x: 99, y: 99 },
          size: { w: 20, h: 20 },
        },
      ],
    });
    const booth = result.booths.find((candidate) => candidate.id === 'booth-old');
    expect(booth?.position).toEqual({ x: 90, y: 90 });
    expect(booth?.size).toEqual({ w: 20, h: 20 });
  });
});
