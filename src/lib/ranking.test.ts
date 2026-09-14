import { describe, expect, it } from 'vitest';
import type { Booth } from '../../shared/types';
import { clipWidthPx, rankBooths, sumAmount } from './ranking';

function booth(id: string, amount: number): Booth {
  return {
    id,
    name: id,
    team: '팀',
    floor: 2,
    amount,
    position: { x: 50, y: 50 },
  };
}

describe('rankBooths', () => {
  it('모금액 내림차순으로 정렬하고 모든 부스를 유지한다', () => {
    const ranked = rankBooths([booth('a', 100), booth('b', 300), booth('c', 200)]);
    expect(ranked.map((entry) => entry.booth.id)).toEqual(['b', 'c', 'a']);
    expect(ranked).toHaveLength(3);
  });

  it('1/2/3위에 금·은·동, 4위 이하에는 공통 색을 부여한다', () => {
    const ranked = rankBooths([
      booth('a', 400),
      booth('b', 300),
      booth('c', 200),
      booth('d', 100),
      booth('e', 50),
    ]);
    expect(ranked.map((entry) => entry.tier)).toEqual([
      'gold',
      'silver',
      'bronze',
      'normal',
      'normal',
    ]);
  });

  it('동률이면 같은 순위를 주고 입력 순서를 유지한다', () => {
    const ranked = rankBooths([booth('a', 100), booth('b', 100), booth('c', 50)]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 1, 3]);
    expect(ranked.map((entry) => entry.booth.id)).toEqual(['a', 'b', 'c']);
  });

  it('금액이 모두 0이어도 안전하게 동작한다', () => {
    const ranked = rankBooths([booth('a', 0), booth('b', 0)]);
    expect(ranked.every((entry) => entry.ratio === 0)).toBe(true);
  });
});

describe('clipWidthPx', () => {
  it('Figma 규격 max(30, ratio * 800)을 따른다', () => {
    expect(clipWidthPx(1)).toBe(800);
    expect(clipWidthPx(0.5)).toBe(400);
    expect(clipWidthPx(0)).toBe(30);
    expect(clipWidthPx(0.01)).toBe(30);
  });
});

describe('sumAmount', () => {
  it('전체 모금액을 합산한다', () => {
    expect(sumAmount([booth('a', 184000), booth('b', 151500)])).toBe(335500);
  });
});
