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
  /** 운영 중 여부 (false 면 "운영 종료" 상태로 취급하되 여전히 노출될 수 있다) */
  isActive: boolean;
  /** 공개 화면 노출 여부 */
  isPublic: boolean;
  /** 보관(soft delete) 처리 시각. null 이면 보관되지 않은 상태 */
  archivedAt: string | null;
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

export interface ScheduleItem {
  id: string;
  /** "HH:MM" */
  time: string;
  title: string;
  note?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FestivalMeta {
  /** 순위 갱신 시각 문구 (예: "9월 8일 오후 3시 기준") */
  updated: string;
  /** 목표 모금액. 0이면 목표 대신 부스 개수 합계를 표시한다. */
  goal: number;
  /** 공연 장소 (예: "대강당") */
  stage: string;
}

export interface FestivalSettings {
  /** false 면 공개 화면/공개 API 에서 순위를 숨긴다. */
  rankingsPublic: boolean;
}

export interface FestivalData {
  meta: FestivalMeta;
  booths: Booth[];
  shows: Show[];
  scheduleItems: ScheduleItem[];
  announcements: Announcement[];
  settings: FestivalSettings;
}

export type BoothInput = Omit<Booth, 'id' | 'archivedAt'>;
export type ShowInput = Omit<Show, 'id'>;
export type ScheduleItemInput = Omit<ScheduleItem, 'id'>;
export type AnnouncementInput = Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>;
