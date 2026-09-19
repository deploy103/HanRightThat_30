import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, here.includes('dist-server') ? '../..' : '..');

/** Vite가 그대로 dist/ 로 복사하는 정적 asset 루트. 저장소에 커밋된 기본 이미지(placeholder 등)가 여기 있다. */
export const PUBLIC_DIR = join(projectRoot, 'public');

/**
 * 저장소에 커밋된 기본 이미지가 놓이는 곳.
 * 개발에서는 public/booth-images, 운영 컨테이너에서는 빌드 산출물인 dist/booth-images 다
 * (Dockerfile 이 public/ 을 그대로 복사하지 않고 dist/ 만 담기 때문에 둘 다 본다).
 */
export const STATIC_BOOTH_IMAGE_DIRS = [
  join(projectRoot, 'dist', 'booth-images'),
  join(PUBLIC_DIR, 'booth-images'),
];

/**
 * 관리자가 업로드한 부스 사진을 두는 곳.
 *
 * public/ 이 아니라 데이터 볼륨 아래에 둔다 — public/ 은 이미지 빌드 시점에 굳어지므로
 * 거기에 쓰면 컨테이너를 다시 빌드/배포할 때마다 업로드한 사진이 사라진다.
 * docker-compose 는 ./data 를 /app/data 로 마운트하므로 이 디렉터리는 재배포에도 살아남는다.
 */
export const BOOTH_IMAGE_UPLOAD_DIR =
  process.env.BOOTH_IMAGE_DIR ?? join(projectRoot, 'data', 'uploads', 'booth-images');

/** 공개 URL 접두사. 저장 위치가 어디든 브라우저에서는 항상 이 경로로 보인다. */
export const BOOTH_IMAGE_URL_PREFIX = '/booth-images/';

const BOOTH_IMAGE_PATH_RE = /^\/booth-images\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.(png|jpe?g|webp|svg)$/;

/** 업로드로 받아들이는 형식. svg 는 스크립트를 품을 수 있어 업로드에서는 제외한다(기존 경로 지정은 계속 허용). */
const UPLOAD_MIME_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const UPLOAD_ALLOWED_MIME_TYPES = Object.keys(UPLOAD_MIME_EXTENSION);

/** 4 MiB. 학교 행사 사진 한 장으로는 충분하고, 디스크/메모리 남용도 막는다. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** 형식만 검사한다 (외부 URL/data:/javascript: 및 경로 탈출 차단). 파일시스템에 접근하지 않는다. */
export function isWellFormedBoothImagePath(value: string): boolean {
  return BOOTH_IMAGE_PATH_RE.test(value);
}

/**
 * 실제로 저장소에 파일이 존재하는지 확인한다 (업로드 디렉터리 → 정적 public 순서).
 * 새로 저장/수정할 때만 호출한다 — 기존에 저장된 데이터를 읽어들일 때(normalize) 호출하면
 * 나중에 파일이 지워졌다는 이유로 멀쩡한 부스 데이터가 통째로 사라질 수 있다.
 */
export function boothImageFileExists(value: string): boolean {
  const name = boothImageFileName(value);
  if (!name) return false;
  if (existsSync(join(BOOTH_IMAGE_UPLOAD_DIR, name))) return true;
  return STATIC_BOOTH_IMAGE_DIRS.some((base) => existsSync(join(base, name)));
}

/**
 * 공개 경로에서 파일명만 떼어 낸다. 형식 검사를 통과한 값만 반환하므로
 * 여기서 나온 이름에는 `/` 도 `..` 도 들어 있을 수 없다 (path traversal 차단 지점).
 */
export function boothImageFileName(value: string): string | null {
  if (!isWellFormedBoothImagePath(value)) return null;
  return value.slice(BOOTH_IMAGE_URL_PREFIX.length);
}

/**
 * 선언된 Content-Type 을 그대로 믿지 않고 실제 바이트(매직 넘버)로 형식을 확인한다.
 * 확장자만 바꾼 스크립트/실행 파일이 이미지로 둔갑해 올라오는 것을 막는다.
 */
export function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export interface SaveBoothImageResult {
  /** 부스 데이터에 저장하는 공개 경로 (예: /booth-images/9f2c….png) */
  imagePath: string;
  bytes: number;
  mimeType: string;
}

/**
 * 업로드된 이미지를 저장한다.
 *
 * 파일명은 서버가 randomUUID 로 새로 만들기 때문에 사용자가 보낸 이름은 어디에도 쓰이지 않는다 —
 * 경로 탈출·덮어쓰기·확장자 위장이 원천적으로 불가능하다.
 */
export async function saveBoothImage(buffer: Buffer, declaredMime: string): Promise<SaveBoothImageResult> {
  const normalizedDeclared = declaredMime.split(';')[0].trim().toLowerCase();
  if (!UPLOAD_MIME_EXTENSION[normalizedDeclared]) {
    throw new Error(`허용되지 않는 이미지 형식입니다. (${UPLOAD_ALLOWED_MIME_TYPES.join(', ')} 만 가능)`);
  }
  if (buffer.length === 0) throw new Error('빈 파일입니다.');
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`이미지는 ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB 이하만 올릴 수 있습니다.`);
  }

  const actual = sniffImageMime(buffer);
  if (!actual) throw new Error('이미지 파일이 아닙니다.');
  if (actual !== normalizedDeclared) {
    throw new Error('파일 내용과 이미지 형식이 일치하지 않습니다.');
  }

  const fileName = `${randomUUID().replace(/-/g, '')}.${UPLOAD_MIME_EXTENSION[actual]}`;
  await mkdir(BOOTH_IMAGE_UPLOAD_DIR, { recursive: true });
  await writeFile(join(BOOTH_IMAGE_UPLOAD_DIR, fileName), buffer);

  return { imagePath: `${BOOTH_IMAGE_URL_PREFIX}${fileName}`, bytes: buffer.length, mimeType: actual };
}

/**
 * 업로드된 이미지를 지운다. 업로드 디렉터리 안의 파일만 지울 수 있고,
 * 저장소에 커밋된 기본 이미지(public/booth-images/)는 건드리지 않는다.
 * 이미 없는 파일이면 조용히 false 를 반환한다.
 */
export async function deleteBoothImage(imagePath: string): Promise<boolean> {
  const name = boothImageFileName(imagePath);
  if (!name) return false;
  const target = join(BOOTH_IMAGE_UPLOAD_DIR, name);
  // join 결과가 업로드 디렉터리를 벗어나면(이론상 불가능하지만) 절대 지우지 않는다.
  if (!resolve(target).startsWith(resolve(BOOTH_IMAGE_UPLOAD_DIR))) return false;
  if (!existsSync(target)) return false;
  await unlink(target);
  return true;
}
