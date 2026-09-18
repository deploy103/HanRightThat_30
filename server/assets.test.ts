import { describe, expect, it } from 'vitest';
import { boothImageFileExists, isWellFormedBoothImagePath } from './assets.js';

describe('isWellFormedBoothImagePath', () => {
  it('허용된 형식만 통과시킨다', () => {
    expect(isWellFormedBoothImagePath('/booth-images/photo.png')).toBe(true);
    expect(isWellFormedBoothImagePath('/booth-images/photo-1_v2.webp')).toBe(true);
  });

  it('외부 URL, data URL, 경로 탈출을 거부한다', () => {
    expect(isWellFormedBoothImagePath('https://example.com/a.png')).toBe(false);
    expect(isWellFormedBoothImagePath('data:image/png;base64,aaaa')).toBe(false);
    expect(isWellFormedBoothImagePath('/booth-images/../secret.png')).toBe(false);
    expect(isWellFormedBoothImagePath('javascript:alert(1)')).toBe(false);
  });

  it('허용되지 않은 확장자를 거부한다', () => {
    expect(isWellFormedBoothImagePath('/booth-images/a.gif')).toBe(false);
    expect(isWellFormedBoothImagePath('/booth-images/a.exe')).toBe(false);
  });
});

describe('boothImageFileExists', () => {
  it('실제로 존재하는 기본 placeholder는 true다', () => {
    expect(boothImageFileExists('/booth-images/placeholder.svg')).toBe(true);
  });

  it('형식은 맞지만 존재하지 않는 파일은 false다', () => {
    expect(boothImageFileExists('/booth-images/no-such-file.png')).toBe(false);
  });
});
