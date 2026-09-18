import { Router } from 'express';
import { rankBooths } from '../../shared/ranking.js';
import { loadData } from '../db.js';
import { publicFestivalView, visibleBooths } from '../publicView.js';
import { asyncRoute } from '../routeUtils.js';
import { noStore } from '../securityHeaders.js';

/**
 * 조회 전용 공개 API. 인증이 없고 GET 만 존재한다.
 * public 페이지는 이 라우터를 통해서만 데이터를 받고, 어떤 mutation 도 노출하지 않는다.
 */
export const publicRouter = Router();

publicRouter.get(
  '/festival',
  asyncRoute(async (_req, res) => {
    res.json(publicFestivalView(await loadData()));
  }),
);

publicRouter.get(
  '/booths',
  asyncRoute(async (_req, res) => {
    res.json(visibleBooths(await loadData()));
  }),
);

publicRouter.get(
  '/performances',
  asyncRoute(async (_req, res) => {
    const data = await loadData();
    res.json(data.shows);
  }),
);

publicRouter.get(
  '/schedule',
  asyncRoute(async (_req, res) => {
    const data = await loadData();
    res.json(data.scheduleItems);
  }),
);

publicRouter.get(
  '/rankings',
  asyncRoute(async (_req, res) => {
    const data = await loadData();
    if (!data.settings.rankingsPublic) {
      res.json({ rankingsPublic: false, rankings: [] });
      return;
    }
    res.json({ rankingsPublic: true, rankings: rankBooths(visibleBooths(data)) });
  }),
);

publicRouter.get(
  '/announcements',
  asyncRoute(async (_req, res) => {
    const data = await loadData();
    res.json(data.announcements.filter((announcement) => announcement.isPublished));
  }),
);

publicRouter.get(
  '/landing',
  noStore,
  asyncRoute(async (_req, res) => {
    const data = await loadData();
    // 초안/revision/계정 정보는 절대 포함하지 않는다 — published만 노출한다.
    res.json({ content: data.landing.published, publishedAt: data.landing.publishedAt });
  }),
);
