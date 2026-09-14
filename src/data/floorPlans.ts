import type { FloorId } from '../../shared/types';

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

/**
 * 2층과 3층은 같은 구조(양끝 계단 + 교실 4칸 + 복도)를 쓰므로
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
    rooms: [
      { id: `${id}-stair-left`, label: '계단', x: 1.5, y: 6, w: 7, h: 88, tone: 'stair' },
      { id: `${id}-stair-right`, label: '계단', x: 91.5, y: 6, w: 7, h: 88, tone: 'stair' },
      ...rooms,
      { id: `${id}-corridor`, label: '복도', x: 10, y: 64, w: 80, h: 30, tone: 'service' },
    ],
  };
}

export const FLOOR_PLANS: Record<FloorId, FloorPlanDef> = {
  2: buildFloor(2, '본관 2층 · 중앙 계단 기준', [
    '지능형소프트웨어과 1-1',
    '메타버스게임과 1-1',
    '클라우드보안과 1-1',
    '클라우드보안과 1-2',
  ]),
  3: buildFloor(3, '본관 3층 · 중앙 계단 기준', [
    '지능형소프트웨어과 2-1',
    '메타버스게임과 2-1',
    '클라우드보안과 2-1',
    '클라우드보안과 2-2',
  ]),
};

export const FLOOR_IDS: FloorId[] = [2, 3];
