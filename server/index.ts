import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { DATA_FILE, loadData } from './db.js';
import { adminCors } from './cors.js';
import { adminRouter } from './routes/admin.js';
import { publicRouter } from './routes/public.js';
import { HttpError } from './validate.js';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, here.includes('dist-server') ? '../..' : '..');
const clientDir = join(projectRoot, 'dist');
const PORT = Number(process.env.PORT ?? 8787);

export function createServer() {
  const app = express();
  app.set('trust proxy', true); // reverse proxy 뒤에서도 req.ip 가 실제 클라이언트 주소를 가리키게 한다.
  app.use(express.json({ limit: '256kb' }));

  app.use('/api/admin', adminCors, adminRouter);
  app.use('/api/public', publicRouter);

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
