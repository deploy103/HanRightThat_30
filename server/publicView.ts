import { rankBooths, sumAmount } from '../shared/ranking.js';
import type { Booth, FestivalData, PublicBooth } from '../shared/types.js';

/** 공개 화면/공개 API 에는 공개(isPublic) + 보관되지 않은(archivedAt=null) 부스만 노출한다. */
export function visibleBooths(data: FestivalData): Booth[] {
  return data.booths.filter((booth) => booth.isPublic && !booth.archivedAt);
}

/**
 * 공개 API 로 내보낼 부스 목록.
 * 순위가 비공개이면 배치도 금액으로 순위를 역산할 수 없도록 amount 를 null 로 비운다
 * (화면에서만 가리면 개발자 도구로 응답을 보면 그대로 드러난다).
 */
export function publicBooths(data: FestivalData): PublicBooth[] {
  const booths = visibleBooths(data);
  if (data.settings.rankingsPublic) return booths;
  return booths.map((booth) => ({ ...booth, amount: null }));
}

export function publicFestivalView(data: FestivalData) {
  const booths = visibleBooths(data);
  const rankingsPublic = data.settings.rankingsPublic;
  return {
    meta: data.meta,
    // 공개 화면도 관리자가 편집한 배치도를 그대로 그린다 (코드에 박힌 레이아웃을 쓰지 않는다).
    floorPlans: data.floorPlans,
    booths: publicBooths(data),
    shows: data.shows,
    scheduleItems: data.scheduleItems,
    announcements: data.announcements.filter((announcement) => announcement.isPublished),
    rankingsPublic,
    // 순위는 항상 서버가 계산해서 내려준다 (클라이언트가 임의로 재계산하지 않는다).
    rankings: rankingsPublic ? rankBooths(booths) : [],
    // 합계도 순위와 함께 숨긴다 — 비공개일 때 0 을 보내면 "0원" 으로 오해되거나 추측 단서가 된다.
    total: rankingsPublic ? sumAmount(booths) : null,
  };
}
