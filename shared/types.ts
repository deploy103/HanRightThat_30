/** 클라이언트/서버가 공유하는 타입 정의 (타입 전용 모듈). */

export type FloorId = 2 | 3;

export interface BoothPosition {
  /** 층 배치도 기준 가로 위치 (0~100%) */
  x: number;
  /** 층 배치도 기준 세로 위치 (0~100%) */
  y: number;
}

export interface Booth {
  id: string;
  name: string;
  team: string;
  floor: FloorId;
  amount: number;
  /** 배치도에서 읽기 쉬우라고 붙이는 보조 위치 라벨 (예: "2층 복도 동편") */
  place?: string;
  position: BoothPosition;
}

export interface Show {
  id: string;
  /** 1부터 시작하는 공연 순서 */
  order: number;
  /** "HH:MM" */
  time: string;
  team: string;
  title: string;
  genre?: string;
  note?: string;
}

export interface FestivalMeta {
  /** 순위 갱신 시각 문구 (예: "9월 8일 오후 3시 기준") */
  updated: string;
  /** 목표 모금액. 0이면 목표 대신 부스 개수 합계를 표시한다. */
  goal: number;
  /** 공연 장소 (예: "대강당") */
  stage: string;
}

export interface FestivalData {
  meta: FestivalMeta;
  booths: Booth[];
  shows: Show[];
}

export type BoothInput = Omit<Booth, 'id'>;
export type ShowInput = Omit<Show, 'id'>;
