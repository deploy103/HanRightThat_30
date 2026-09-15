import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface JsonStore<T> {
  readonly filePath: string;
  load(): Promise<T>;
  mutate<R>(mutator: (data: T) => [T, R]): Promise<R>;
  resetCache(): void;
}

/**
 * 파일 하나를 원자적 쓰기(JSON)로 관리하는 최소 저장소.
 * festival 데이터와 admin 데이터가 이 팩토리를 각자 인스턴스화해서 쓴다.
 */
export function createJsonStore<T>(
  filePath: string,
  createSeed: () => T,
  normalize: (raw: unknown) => T,
): JsonStore<T> {
  let cache: T | null = null;
  /** 동시 쓰기 요청이 서로를 덮어쓰지 않도록 직렬화한다. */
  let writeChain: Promise<unknown> = Promise.resolve();

  async function persist(data: T): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await rename(tmp, filePath);
  }

  async function load(): Promise<T> {
    if (cache) return cache;
    try {
      const raw = await readFile(filePath, 'utf8');
      cache = normalize(JSON.parse(raw));
    } catch {
      cache = createSeed();
      await persist(cache);
    }
    return cache;
  }

  async function mutate<R>(mutator: (data: T) => [T, R]): Promise<R> {
    const run = writeChain.then(async () => {
      const current = await load();
      const [next, result] = mutator(current);
      cache = next;
      await persist(next);
      return result;
    });
    // 체인은 실패해도 끊기지 않아야 한다.
    writeChain = run.catch(() => undefined);
    return run;
  }

  function resetCache(): void {
    cache = null;
  }

  return { filePath, load, mutate, resetCache };
}
