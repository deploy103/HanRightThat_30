import { rankBooths, sumAmount } from '../shared/ranking.js';
import type { Booth, FestivalData } from '../shared/types.js';

/** 공개 화면/공개 API 에는 공개(isPublic) + 보관되지 않은(archivedAt=null) 부스만 노출한다. */
export function visibleBooths(data: FestivalData): Booth[] {
  return data.booths.filter((booth) => booth.isPublic && !booth.archivedAt);
}

export function publicFestivalView(data: FestivalData) {
  const booths = visibleBooths(data);
  const rankingsPublic = data.settings.rankingsPublic;
  return {
    meta: data.meta,
    booths,
    shows: data.shows,
    scheduleItems: data.scheduleItems,
    announcements: data.announcements.filter((announcement) => announcement.isPublished),
    rankingsPublic,
    // 순위는 항상 서버가 계산해서 내려준다 (클라이언트가 임의로 재계산하지 않는다).
    rankings: rankingsPublic ? rankBooths(booths) : [],
    total: sumAmount(booths),
  };
}
