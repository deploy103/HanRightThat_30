import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as DbModule from './db.js';
import type { FestivalData } from '../shared/types.js';

let dir: string;
let db: typeof DbModule;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hanbit-test-'));
  process.env.FESTIVAL_DB = join(dir, 'festival.json');
  // 환경변수를 세팅한 뒤에 모듈을 읽어야 테스트용 경로가 적용된다.
  db = await import('./db.js');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.FESTIVAL_DB;
});

describe('영속 저장', () => {
  it('최초 실행 시 기본 부스 8개로 시드한다', async () => {
    const data = await db.loadData();
    expect(data.booths).toHaveLength(8);
    expect(data.booths.filter((booth) => booth.floor === 2)).toHaveLength(4);
    expect(data.booths.filter((booth) => booth.floor === 3)).toHaveLength(4);
  });

  it('변경 내용이 파일에 저장되어 재시작 후에도 유지된다', async () => {
    await db.mutate<void>((current: FestivalData) => [
      {
        ...current,
        booths: [
          ...current.booths,
          {
            id: 'booth-test',
            name: '테스트 부스',
            team: '검증팀',
            floor: 3,
            amount: 12345,
            position: { x: 10, y: 20 },
          },
        ],
      },
      undefined,
    ]);

    // 메모리 캐시를 비우면 재시작과 동일하게 파일에서 다시 읽는다.
    db.resetCache();
    const reloaded = await db.loadData();
    const saved = reloaded.booths.find((booth) => booth.id === 'booth-test');
    expect(saved?.amount).toBe(12345);
    expect(reloaded.booths).toHaveLength(9);
  });
});
