import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, here.includes('dist-server') ? '../..' : '..');

/** Vite가 그대로 dist/ 로 복사하는 정적 asset 루트. 개발/운영 모두 이 경로 아래만 이미지로 허용한다. */
export const PUBLIC_DIR = join(projectRoot, 'public');

const BOOTH_IMAGE_PATH_RE = /^\/booth-images\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.(png|jpe?g|webp|svg)$/;

/** 형식만 검사한다 (외부 URL/data:/javascript: 및 경로 탈출 차단). 파일시스템에 접근하지 않는다. */
export function isWellFormedBoothImagePath(value: string): boolean {
  return BOOTH_IMAGE_PATH_RE.test(value);
}

/**
 * 실제로 저장소에 파일이 존재하는지 확인한다.
 * 새로 저장/수정할 때만 호출한다 — 기존에 저장된 데이터를 읽어들일 때(normalize) 호출하면
 * 나중에 파일이 지워졌다는 이유로 멀쩡한 부스 데이터가 통째로 사라질 수 있다.
 */
export function boothImageFileExists(value: string): boolean {
  if (!isWellFormedBoothImagePath(value)) return false;
  return existsSync(join(PUBLIC_DIR, value.replace(/^\//, '')));
}
