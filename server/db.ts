import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FestivalData } from '../shared/types.js';
import { createSeedData } from './seed.js';
import { normalizeFestivalData } from './validate.js';

const here = dirname(fileURLToPath(import.meta.url));
/** dist-server/server/db.js 에서도 프로젝트 루트를 가리키도록 상위 경로를 찾는다. */
const projectRoot = resolve(here, here.includes('dist-server') ? '../..' : '..');

export const DATA_FILE = process.env.FESTIVAL_DB ?? join(projectRoot, 'data', 'festival.json');

let cache: FestivalData | null = null;
/** 동시 쓰기 요청이 서로를 덮어쓰지 않도록 직렬화한다. */
let writeChain: Promise<unknown> = Promise.resolve();

async function persist(data: FestivalData): Promise<void> {
  const file = DATA_FILE;
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(tmp, file);
}

/** 파일에서 데이터를 읽는다. 파일이 없거나 깨져 있으면 시드 데이터로 새로 만든다. */
export async function loadData(): Promise<FestivalData> {
  if (cache) return cache;
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    cache = normalizeFestivalData(JSON.parse(raw));
  } catch {
    cache = createSeedData();
    await persist(cache);
  }
  return cache;
}

/**
 * 현재 데이터를 받아 새 데이터를 반환하는 mutator 를 실행하고 파일에 저장한다.
 * 저장이 끝난 뒤에야 응답하므로 앱 재시작 후에도 값이 유지된다.
 */
export async function mutate<T>(mutator: (data: FestivalData) => [FestivalData, T]): Promise<T> {
  const run = writeChain.then(async () => {
    const current = await loadData();
    const [next, result] = mutator(current);
    cache = next;
    await persist(next);
    return result;
  });
  // 체인은 실패해도 끊기지 않아야 한다.
  writeChain = run.catch(() => undefined);
  return run;
}

/** 테스트용: 메모리 캐시를 비운다. */
export function resetCache(): void {
  cache = null;
}
