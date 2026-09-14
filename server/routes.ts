import { randomUUID } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { Booth, FestivalData, Show } from '../shared/types.js';
import { loadData, mutate } from './db.js';
import {
  HttpError,
  parseBoothInput,
  parseIdList,
  parseMetaInput,
  parseShowInput,
} from './validate.js';

const ADMIN_KEY = process.env.ADMIN_KEY ?? '';

/** ADMIN_KEY 환경변수가 설정된 경우에만 쓰기 요청에 키를 요구한다. */
function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!ADMIN_KEY) return next();
  const key = req.header('x-admin-key');
  if (key !== ADMIN_KEY) return next(new HttpError(401, '관리자 키가 올바르지 않습니다.'));
  next();
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}

function renumberShows(shows: Show[]): Show[] {
  return shows.map((show, index) => ({ ...show, order: index + 1 }));
}

function findIndexOrThrow<T extends { id: string }>(items: T[], id: string, label: string): number {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) throw new HttpError(404, `${label}을(를) 찾을 수 없습니다.`);
  return index;
}

export const apiRouter = Router();

apiRouter.get(
  '/festival',
  asyncRoute(async (_req, res) => {
    res.json(await loadData());
  }),
);

apiRouter.get('/admin/status', (_req, res) => {
  res.json({ protected: ADMIN_KEY !== '' });
});

apiRouter.put(
  '/meta',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const meta = parseMetaInput(req.body);
    const data = await mutate<FestivalData>((current) => {
      const next = { ...current, meta };
      return [next, next];
    });
    res.json(data);
  }),
);

apiRouter.post(
  '/booths',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const input = parseBoothInput(req.body);
    const booth: Booth = { id: randomUUID(), ...input };
    await mutate<void>((current) => [{ ...current, booths: [...current.booths, booth] }, undefined]);
    res.status(201).json(booth);
  }),
);

apiRouter.put(
  '/booths/:id',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const input = parseBoothInput(req.body);
    const { id } = req.params;
    const booth = await mutate<Booth>((current) => {
      const index = findIndexOrThrow(current.booths, id, '부스');
      const updated: Booth = { id, ...input };
      const booths = [...current.booths];
      booths[index] = updated;
      return [{ ...current, booths }, updated];
    });
    res.json(booth);
  }),
);

apiRouter.delete(
  '/booths/:id',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    await mutate<void>((current) => {
      findIndexOrThrow(current.booths, id, '부스');
      return [{ ...current, booths: current.booths.filter((booth) => booth.id !== id) }, undefined];
    });
    res.status(204).end();
  }),
);

apiRouter.post(
  '/shows',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const input = parseShowInput(req.body);
    const show = await mutate<Show>((current) => {
      const created: Show = { id: randomUUID(), order: current.shows.length + 1, ...input };
      return [{ ...current, shows: [...current.shows, created] }, created];
    });
    res.status(201).json(show);
  }),
);

apiRouter.put(
  '/shows/order',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const ids = parseIdList(req.body);
    const shows = await mutate<Show[]>((current) => {
      const byId = new Map(current.shows.map((show) => [show.id, show]));
      const ordered = ids.flatMap((id) => {
        const show = byId.get(id);
        if (!show) return [];
        byId.delete(id);
        return [show];
      });
      // 목록에 없던 공연은 뒤에 그대로 남긴다.
      const next = renumberShows([...ordered, ...byId.values()]);
      return [{ ...current, shows: next }, next];
    });
    res.json(shows);
  }),
);

apiRouter.put(
  '/shows/:id',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const input = parseShowInput(req.body);
    const { id } = req.params;
    const show = await mutate<Show>((current) => {
      const index = findIndexOrThrow(current.shows, id, '공연');
      const updated: Show = { ...current.shows[index], id, ...input };
      const shows = [...current.shows];
      shows[index] = updated;
      return [{ ...current, shows }, updated];
    });
    res.json(show);
  }),
);

apiRouter.delete(
  '/shows/:id',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    await mutate<void>((current) => {
      findIndexOrThrow(current.shows, id, '공연');
      const shows = renumberShows(current.shows.filter((show) => show.id !== id));
      return [{ ...current, shows }, undefined];
    });
    res.status(204).end();
  }),
);
