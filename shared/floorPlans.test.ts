import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOOTH_SIZE,
  FLOOR_IDS,
  FLOOR_PLANS,
  fromRect,
  MIN_BOOTH_SIZE,
  toRect,
} from './floorPlans.js';

describe('층 배치도 레이아웃', () => {
  it('2층과 3층 모두 정의되어 있다', () => {
    expect(FLOOR_IDS).toEqual([2, 3]);
    expect(FLOOR_PLANS[2].rooms.length).toBe(FLOOR_PLANS[3].rooms.length);
  });

  it('왼쪽 계단은 제거되고 오른쪽 계단만 남는다', () => {
    for (const floor of FLOOR_IDS) {
      const stairs = FLOOR_PLANS[floor].rooms.filter((room) => room.tone === 'stair');
      expect(stairs).toHaveLength(1);
      expect(stairs[0].id).toBe(`${floor}-stair-right`);
      expect(FLOOR_PLANS[floor].rooms.some((room) => room.id.endsWith('stair-left'))).toBe(false);
    }
  });

  it('교실·복도 좌표는 그대로 유지된다 (기존 부스 위치가 어긋나지 않도록)', () => {
    const rooms = FLOOR_PLANS[2].rooms.filter((room) => room.tone === 'room');
    expect(rooms.map((room) => room.x)).toEqual([10, 31, 52, 73]);
    const corridor = FLOOR_PLANS[2].rooms.find((room) => room.id === '2-corridor');
    expect(corridor).toMatchObject({ x: 10, y: 64, w: 80, h: 30 });
  });

  it('모든 방이 배치도(0~100%) 안에 들어온다', () => {
    for (const floor of FLOOR_IDS) {
      for (const room of FLOOR_PLANS[floor].rooms) {
        expect(room.x).toBeGreaterThanOrEqual(0);
        expect(room.y).toBeGreaterThanOrEqual(0);
        expect(room.x + room.w).toBeLessThanOrEqual(100);
        expect(room.y + room.h).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('부스 좌표 변환 (중심+크기 ↔ 왼쪽위+크기)', () => {
  it('size 가 없는 기존 데이터는 기본 크기로 그려진다', () => {
    expect(toRect({ x: 50, y: 50 }, undefined)).toEqual({
      left: 50 - DEFAULT_BOOTH_SIZE.w / 2,
      top: 50 - DEFAULT_BOOTH_SIZE.h / 2,
      width: DEFAULT_BOOTH_SIZE.w,
      height: DEFAULT_BOOTH_SIZE.h,
    });
  });

  it('toRect → fromRect 왕복이 원래 값을 보존한다', () => {
    const position = { x: 61.5, y: 33 };
    const size = { w: 14, h: 10 };
    expect(fromRect(toRect(position, size))).toEqual({ position, size });
  });

  it('배치도 밖으로 나가는 사각형은 안쪽으로 밀어 넣는다', () => {
    expect(fromRect({ left: -20, top: -10, width: 20, height: 10 })).toEqual({
      position: { x: 10, y: 5 },
      size: { w: 20, h: 10 },
    });
    expect(fromRect({ left: 95, top: 96, width: 20, height: 10 })).toEqual({
      position: { x: 90, y: 95 },
      size: { w: 20, h: 10 },
    });
  });

  it('최소 크기보다 작게는 만들 수 없다', () => {
    const result = fromRect({ left: 10, top: 10, width: 0.5, height: 0 });
    expect(result.size).toEqual({ w: MIN_BOOTH_SIZE.w, h: MIN_BOOTH_SIZE.h });
  });
});
