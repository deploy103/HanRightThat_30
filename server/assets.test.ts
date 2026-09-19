import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as AssetsModule from './assets.js';

let dir: string;
let assets: typeof AssetsModule;

/** 유효한 최소 PNG/JPEG/WebP 헤더 (매직 넘버 검사만 확인하면 되므로 뒤쪽 바이트는 채우기용). */
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 2)]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.alloc(4, 0),
  Buffer.from('WEBP', 'ascii'),
  Buffer.alloc(32, 3),
]);

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hanbit-upload-test-'));
  process.env.BOOTH_IMAGE_DIR = join(dir, 'booth-images');
  assets = await import('./assets.js');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.BOOTH_IMAGE_DIR;
});

describe('isWellFormedBoothImagePath', () => {
  it('허용된 형식만 통과시킨다', () => {
    expect(assets.isWellFormedBoothImagePath('/booth-images/photo.png')).toBe(true);
    expect(assets.isWellFormedBoothImagePath('/booth-images/photo-1_v2.webp')).toBe(true);
  });

  it('외부 URL, data URL, 경로 탈출을 거부한다', () => {
    expect(assets.isWellFormedBoothImagePath('https://example.com/a.png')).toBe(false);
    expect(assets.isWellFormedBoothImagePath('data:image/png;base64,aaaa')).toBe(false);
    expect(assets.isWellFormedBoothImagePath('/booth-images/../secret.png')).toBe(false);
    expect(assets.isWellFormedBoothImagePath('/booth-images/sub/dir.png')).toBe(false);
    expect(assets.isWellFormedBoothImagePath('javascript:alert(1)')).toBe(false);
  });

  it('허용되지 않은 확장자를 거부한다', () => {
    expect(assets.isWellFormedBoothImagePath('/booth-images/a.gif')).toBe(false);
    expect(assets.isWellFormedBoothImagePath('/booth-images/a.exe')).toBe(false);
  });
});

describe('boothImageFileName (path traversal 차단)', () => {
  it('형식을 통과한 경로에서만 파일명을 뽑는다', () => {
    expect(assets.boothImageFileName('/booth-images/a.png')).toBe('a.png');
    expect(assets.boothImageFileName('/booth-images/../../etc/passwd')).toBeNull();
    expect(assets.boothImageFileName('/etc/passwd')).toBeNull();
  });
});

describe('boothImageFileExists', () => {
  it('저장소에 커밋된 기본 placeholder는 true다', () => {
    expect(assets.boothImageFileExists('/booth-images/placeholder.svg')).toBe(true);
  });

  it('형식은 맞지만 존재하지 않는 파일은 false다', () => {
    expect(assets.boothImageFileExists('/booth-images/no-such-file.png')).toBe(false);
  });
});

describe('sniffImageMime (확장자 위장 차단)', () => {
  it('실제 바이트로 형식을 판정한다', () => {
    expect(assets.sniffImageMime(PNG)).toBe('image/png');
    expect(assets.sniffImageMime(JPEG)).toBe('image/jpeg');
    expect(assets.sniffImageMime(WEBP)).toBe('image/webp');
  });

  it('이미지가 아니면 null 이다', () => {
    expect(assets.sniffImageMime(Buffer.from('<?php system($_GET["c"]); ?>'))).toBeNull();
    expect(assets.sniffImageMime(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
    expect(assets.sniffImageMime(Buffer.alloc(0))).toBeNull();
  });
});

describe('saveBoothImage', () => {
  it('업로드한 파일명은 서버가 새로 만든다 (사용자 입력이 경로에 들어가지 않는다)', async () => {
    const saved = await assets.saveBoothImage(PNG, 'image/png');
    expect(saved.imagePath).toMatch(/^\/booth-images\/[0-9a-f]{32}\.png$/);
    expect(assets.boothImageFileExists(saved.imagePath)).toBe(true);

    const files = await readdir(join(dir, 'booth-images'));
    expect(files).toContain(saved.imagePath.replace('/booth-images/', ''));
  });

  it('Content-Type 과 실제 내용이 다르면 거부한다', async () => {
    await expect(assets.saveBoothImage(PNG, 'image/jpeg')).rejects.toThrow();
  });

  it('이미지가 아닌 파일은 거부한다', async () => {
    await expect(assets.saveBoothImage(Buffer.from('#!/bin/sh\nrm -rf /'), 'image/png')).rejects.toThrow();
  });

  it('허용하지 않는 MIME 타입(svg 등)은 거부한다', async () => {
    await expect(assets.saveBoothImage(Buffer.from('<svg/>'), 'image/svg+xml')).rejects.toThrow();
    await expect(assets.saveBoothImage(PNG, 'text/html')).rejects.toThrow();
  });

  it('용량 제한을 넘기면 거부한다', async () => {
    const tooBig = Buffer.concat([PNG, Buffer.alloc(assets.MAX_UPLOAD_BYTES, 0)]);
    await expect(assets.saveBoothImage(tooBig, 'image/png')).rejects.toThrow();
  });

  it('빈 파일은 거부한다', async () => {
    await expect(assets.saveBoothImage(Buffer.alloc(0), 'image/png')).rejects.toThrow();
  });
});

describe('deleteBoothImage', () => {
  it('업로드 디렉터리의 파일만 지운다', async () => {
    const saved = await assets.saveBoothImage(JPEG, 'image/jpeg');
    expect(await assets.deleteBoothImage(saved.imagePath)).toBe(true);
    expect(assets.boothImageFileExists(saved.imagePath)).toBe(false);
  });

  it('저장소에 커밋된 기본 이미지는 지우지 않는다', async () => {
    expect(await assets.deleteBoothImage('/booth-images/placeholder.svg')).toBe(false);
    expect(assets.boothImageFileExists('/booth-images/placeholder.svg')).toBe(true);
  });

  it('형식이 어긋난 경로는 그대로 거부한다', async () => {
    expect(await assets.deleteBoothImage('/booth-images/../../package.json')).toBe(false);
  });
});
