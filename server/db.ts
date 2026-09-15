import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FestivalData } from '../shared/types.js';
import { createJsonStore } from './jsonStore.js';
import { createSeedData } from './seed.js';
import { normalizeFestivalData } from './validate.js';

const here = dirname(fileURLToPath(import.meta.url));
/** dist-server/server/db.js 에서도 프로젝트 루트를 가리키도록 상위 경로를 찾는다. */
const projectRoot = resolve(here, here.includes('dist-server') ? '../..' : '..');

export const DATA_FILE = process.env.FESTIVAL_DB ?? join(projectRoot, 'data', 'festival.json');

const store = createJsonStore<FestivalData>(DATA_FILE, createSeedData, normalizeFestivalData);

/** 파일에서 데이터를 읽는다. 파일이 없거나 깨져 있으면 시드 데이터로 새로 만든다. */
export const loadData = store.load;

/**
 * 현재 데이터를 받아 새 데이터를 반환하는 mutator 를 실행하고 파일에 저장한다.
 * 저장이 끝난 뒤에야 응답하므로 앱 재시작 후에도 값이 유지된다.
 */
export const mutate = store.mutate;

/** 테스트용: 메모리 캐시를 비운다. */
export const resetCache = store.resetCache;
