import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { BOOTH_IMAGE_UPLOAD_DIR, STATIC_BOOTH_IMAGE_DIRS } from './assets.js';
import { DATA_FILE, loadData } from './db.js';
import { adminCors } from './cors.js';
import { adminRouter } from './routes/admin.js';
import { publicRouter } from './routes/public.js';
import { noStore, securityHeaders } from './securityHeaders.js';
import { HttpError } from './validate.js';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, here.includes('dist-server') ? '../..' : '..');
const clientDir = join(projectRoot, 'dist');
const PORT = Number(process.env.PORT ?? 8787);

export function createServer() {
  const app = express();
  // 정확히 리버스 프록시 한 홉(nginx) 뒤에 있다고 가정한다 — 그래야 클라이언트가 보낸
  // X-Forwarded-For 를 그대로 신뢰해 req.ip 를 위조(rate limit/감사로그 우회)할 수 없다.
  // 배포 구조가 바뀌어 프록시가 여러 단이 되면 이 숫자도 함께 조정해야 한다.
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));
  app.use(securityHeaders);

  app.use('/api/admin', adminCors, noStore, adminRouter);
  app.use('/api/public', publicRouter);

  // 부스 사진: 관리자가 올린 파일(데이터 볼륨)을 먼저 찾고, 없으면 저장소에 커밋된 기본 이미지를 쓴다.
  // SPA fallback 보다 먼저 등록하고 마지막에 404 로 끊어, 없는 이미지 요청이 index.html 로 응답되지 않게 한다.
  const boothImageStaticOptions = {
    // 업로드 파일명은 랜덤이라 내용이 바뀌지 않는다 — 길게 캐시해도 안전하다.
    maxAge: '7d',
    index: false,
    dotfiles: 'deny' as const,
    fallthrough: true,
    setHeaders: (res: Response) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // 업로드된 파일이 브라우저에서 문서로 해석되지 않도록 한 겹 더 막는다.
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
    },
  };
  app.use('/booth-images', express.static(BOOTH_IMAGE_UPLOAD_DIR, boothImageStaticOptions));
  for (const dir of STATIC_BOOTH_IMAGE_DIRS) {
    app.use('/booth-images', express.static(dir, boothImageStaticOptions));
  }
  app.use('/booth-images', (_req, res) => {
    res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
  });

  // 위 라우터들과 매칭되지 않은 /api/* 요청은 SPA fallback이 가로채지 않고 JSON 404로 응답한다.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: '요청한 API를 찾을 수 없습니다.' });
  });

  // 빌드된 클라이언트가 있으면 같은 포트에서 함께 제공한다 (production).
  if (existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(join(clientDir, 'index.html'));
    });
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    // body-parser(express.json / express.raw)가 던지는 요청 본문 오류는 서버 오류가 아니라
    // 잘못된 요청이다 — 500 으로 뭉뚱그리지 않고 원인을 알려 준다.
    const parserError = error as { type?: string; status?: number } | null;
    if (parserError?.type === 'entity.too.large') {
      res.status(413).json({ error: '보낸 데이터가 너무 큽니다. 이미지는 4MB 이하만 올릴 수 있습니다.' });
      return;
    }
    if (parserError?.type === 'entity.parse.failed') {
      res.status(400).json({ error: '요청 본문 형식이 올바르지 않습니다.' });
      return;
    }
    console.error(error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  });

  return app;
}

const isDirectRun = process.argv[1] ? resolve(process.argv[1]).includes('server') : false;

if (isDirectRun) {
  loadData()
    .then(() => {
      createServer().listen(PORT, () => {
        console.log(`[한빛제] API 서버 http://127.0.0.1:${PORT}`);
        console.log(`[한빛제] 데이터 파일 ${DATA_FILE}`);
      });
    })
    .catch((error: unknown) => {
      console.error('[한빛제] 데이터 로드 실패', error);
      process.exit(1);
    });
}
