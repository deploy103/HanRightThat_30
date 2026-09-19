/**
 * 층 배치도(Floor Map) 단일 진실 공급원.
 *
 * 공개 화면(읽기 전용 렌더러)과 관리자 GUI 편집기가 같은 좌표계·같은 레이아웃을 쓰도록
 * 이 파일 하나만 바라본다. 관리자 저장소는 파일을 공유하지 않으므로
 * `GET /api/public/floor-plans` 로 이 데이터를 그대로 받아 간다.
 *
 * 좌표계 규칙 (부스/교실 공통)
 * - 모든 값은 배치도 상자 기준 0~100 % 다. 픽셀 절대좌표는 어디에도 저장하지 않는다.
 * - 배치도 상자는 항상 FLOOR_ASPECT 비율을 유지하므로 PC·태블릿·모바일에서
 *   같은 % 값이 같은 위치를 가리킨다.
 * - 교실(FloorRoom)은 왼쪽 위(x, y) + 너비/높이(w, h) 기준이고,
 *   부스(Booth.position/size)는 "중심점 + 크기" 기준이다.
 *   (기존 데이터의 position 이 핀 중심이었기 때문에 그대로 호환된다.)
 */

import type { FloorId } from './types.js';

export type RoomTone = 'room' | 'special' | 'stair' | 'service';

export interface FloorRoom {
  id: string;
  label: string;
  /** 배치도 기준 % 좌표 (왼쪽 위 0,0) */
  x: number;
  y: number;
  w: number;
  h: number;
  tone: RoomTone;
}

export interface FloorPlanDef {
  id: FloorId;
  label: string;
  hint: string;
  rooms: FloorRoom[];
}

/** 배치도 상자의 가로:세로 비율. 렌더러(CSS aspect-ratio)와 반드시 같아야 한다. */
export const FLOOR_ASPECT = { width: 660, height: 470 } as const;

/** 부스 영역 기본 크기 (%) — 크기를 지정하지 않은 기존 데이터에 적용된다. */
export const DEFAULT_BOOTH_SIZE = { w: 14, h: 10 } as const;

/** 편집기에서 허용하는 최소 부스 크기 (%) — 이보다 작으면 클릭/터치가 불가능해진다. */
export const MIN_BOOTH_SIZE = { w: 4, h: 4 } as const;

/**
 * 2층과 3층은 같은 구조(오른쪽 계단 + 교실 4칸 + 복도)를 쓰므로
 * 레이아웃을 복제하지 않고 교실 이름만 데이터로 분리한다.
 */
function buildFloor(id: FloorId, hint: string, classrooms: string[]): FloorPlanDef {
  const columns = [
    { x: 10, w: 19 },
    { x: 31, w: 19 },
    { x: 52, w: 19 },
    { x: 73, w: 17 },
  ];

  const rooms: FloorRoom[] = classrooms.slice(0, columns.length).map((label, index) => ({
    id: `${id}-room-${index}`,
    label,
    x: columns[index].x,
    y: 6,
    w: columns[index].w,
    h: 54,
    tone: 'room',
  }));

  return {
    id,
    label: `${id}층`,
    hint,
    // 왼쪽 계단은 실제 배치와 달라 제거했다 (오른쪽 계단만 남긴다).
    // 교실/복도 좌표는 그대로 두어 기존 부스 위치가 어긋나지 않는다.
    rooms: [
      { id: `${id}-stair-right`, label: '계단', x: 91.5, y: 6, w: 7, h: 88, tone: 'stair' },
      ...rooms,
      { id: `${id}-corridor`, label: '복도', x: 10, y: 64, w: 80, h: 30, tone: 'service' },
    ],
  };
}

export const FLOOR_PLANS: Record<FloorId, FloorPlanDef> = {
  2: buildFloor(2, '본관 2층 · 중앙 복도 기준', [
    '지능형소프트웨어과 1-1',
    '메타버스게임과 1-1',
    '클라우드보안과 1-1',
    '클라우드보안과 1-2',
  ]),
  3: buildFloor(3, '본관 3층 · 중앙 복도 기준', [
    '지능형소프트웨어과 2-1',
    '메타버스게임과 2-1',
    '클라우드보안과 2-1',
    '클라우드보안과 2-2',
  ]),
};

export const FLOOR_IDS: FloorId[] = [2, 3];

export interface BoothRect {
  /** 왼쪽 위 기준 % */
  left: number;
  top: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 소수점 1자리로 맞춘다 (저장/표시 모두 같은 규칙을 쓴다). */
export function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

/** "중심점 + 크기" 를 CSS 에 그대로 넣을 수 있는 "왼쪽 위 + 크기" 로 바꾼다. */
export function toRect(
  position: { x: number; y: number },
  size: { w: number; h: number } | undefined,
): BoothRect {
  const w = size?.w ?? DEFAULT_BOOTH_SIZE.w;
  const h = size?.h ?? DEFAULT_BOOTH_SIZE.h;
  return { left: position.x - w / 2, top: position.y - h / 2, width: w, height: h };
}

/** 왼쪽 위 기준 사각형을 저장 형식(중심점 + 크기)으로 되돌린다. 배치도 밖으로 나가지 않게 가둔다. */
export function fromRect(rect: BoothRect): { position: { x: number; y: number }; size: { w: number; h: number } } {
  const w = clamp(rect.width, MIN_BOOTH_SIZE.w, 100);
  const h = clamp(rect.height, MIN_BOOTH_SIZE.h, 100);
  const left = clamp(rect.left, 0, 100 - w);
  const top = clamp(rect.top, 0, 100 - h);
  return {
    position: { x: roundPercent(left + w / 2), y: roundPercent(top + h / 2) },
    size: { w: roundPercent(w), h: roundPercent(h) },
  };
}
