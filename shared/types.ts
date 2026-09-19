/** 클라이언트/서버가 공유하는 타입 정의 (타입 전용 모듈). */

export type FloorId = 2 | 3;

export interface BoothPosition {
  /** 층 배치도 기준 가로 위치 (0~100%). 부스 영역의 "중심" 이다. */
  x: number;
  /** 층 배치도 기준 세로 위치 (0~100%). 부스 영역의 "중심" 이다. */
  y: number;
}

/** 부스 영역 크기. 픽셀이 아니라 배치도 대비 비율(0~100%)이라 화면 크기가 달라져도 위치가 맞는다. */
export interface BoothSize {
  w: number;
  h: number;
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
  /** 배치도에서 차지하는 영역 크기(%). 없으면 DEFAULT_BOOTH_SIZE 로 그린다. */
  size?: BoothSize;
  /** 운영 중 여부 (false 면 "운영 종료" 상태로 취급하되 여전히 노출될 수 있다) */
  isActive: boolean;
  /** 공개 화면 노출 여부 */
  isPublic: boolean;
  /** 보관(soft delete) 처리 시각. null 이면 보관되지 않은 상태 */
  archivedAt: string | null;
  /** 소개 페이지 부스 미리보기용 한 줄 소개 (최대 300자) */
  summary?: string;
  /** 소개 페이지 부스 상세 설명 (최대 3000자) */
  description?: string;
  /** 허용된 public/booth-images/ 아래의 정적 이미지 경로. 없으면 빈 문자열/undefined */
  imagePath?: string;
  /** imagePath 사용 시 필수인 대체 텍스트 */
  imageAlt?: string;
}

/** 소개 페이지 FAQ 한 항목. 배열 순서가 표시 순서다. */
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

/**
 * 소개 페이지 콘텐츠. HANWOL-INTRO-V1 계약 — 공개/관리자 저장소가 동일하게 따른다.
 * 날짜(startsAt/endsAt)는 시간대 오프셋을 포함한 ISO 문자열 또는 null(미정)이다.
 */
export interface LandingContent {
  festivalName: string;
  edition: number;
  year: number;
  theme: string;
  heroTitle: string;
  heroDescription: string;
  startsAt: string | null;
  endsAt: string | null;
  venueName: string;
  address: string;
  directionsUrl: string;
  themeTitle: string;
  themeBody: string;
  audienceInfo: string;
  admissionInfo: string;
  paymentInfo: string;
  operatingHoursInfo: string;
  contactInfo: string;
  organizerText: string;
  creditsText: string;
  faqItems: FaqItem[];
}

/**
 * 초안/게시 분리 상태. revision은 draft 저장 또는 게시가 성공할 때마다 증가하며
 * 관리자 PUT/POST 요청의 expectedRevision과 비교해 동시 편집 충돌(409)을 검출한다.
 */
export interface LandingState {
  revision: number;
  draft: LandingContent;
  published: LandingContent | null;
  publishedAt: string | null;
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
  /** 저장 데이터 마이그레이션 버전. normalizeFestivalData 가 올려 준다. */
  dataVersion?: number;
  meta: FestivalMeta;
  booths: Booth[];
  shows: Show[];
  scheduleItems: ScheduleItem[];
  announcements: Announcement[];
  settings: FestivalSettings;
  landing: LandingState;
}

export type BoothInput = Omit<Booth, 'id' | 'archivedAt'>;
export type ShowInput = Omit<Show, 'id'>;
export type ScheduleItemInput = Omit<ScheduleItem, 'id'>;
export type AnnouncementInput = Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>;
