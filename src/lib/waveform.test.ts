import { describe, expect, it } from 'vitest';
import { hashSeed, waveformPath } from './waveform';

describe('waveformPath', () => {
  it('같은 seed 면 항상 같은 파형을 만든다', () => {
    const seed = hashSeed('booth-cottoncandy');
    expect(waveformPath(seed, 40, 600, 42)).toBe(waveformPath(seed, 40, 600, 42));
  });

  it('seed 가 다르면 다른 파형을 만든다', () => {
    const a = waveformPath(hashSeed('booth-a'), 40, 600, 42);
    const b = waveformPath(hashSeed('booth-b'), 40, 600, 42);
    expect(a).not.toBe(b);
  });
});
