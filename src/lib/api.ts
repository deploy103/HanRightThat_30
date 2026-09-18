import type { RankedBooth } from '../../shared/ranking';
import type { Announcement, Booth, FestivalMeta, LandingContent, ScheduleItem, Show } from '../../shared/types';

/** 공개 API(`/api/public/festival`) 응답 모양. 관리자 전용 필드는 포함되지 않는다. */
export interface PublicFestival {
  meta: FestivalMeta;
  booths: Booth[];
  shows: Show[];
  scheduleItems: ScheduleItem[];
  announcements: Announcement[];
  rankingsPublic: boolean;
  rankings: RankedBooth[];
  total: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`);

  if (!response.ok) {
    let message = `요청이 실패했습니다. (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* 본문이 JSON 이 아니면 기본 메시지를 쓴다. */
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}

/** 공개 소개 API 응답 모양. 초안/revision/계정 정보는 포함되지 않는다. */
export interface PublicLanding {
  content: LandingContent | null;
  publishedAt: string | null;
}

/** public 페이지는 조회 전용 client 다 — mutation 메서드를 두지 않는다. */
export const api = {
  getFestival: () => request<PublicFestival>('/public/festival'),
  getLanding: () => request<PublicLanding>('/public/landing'),
};
