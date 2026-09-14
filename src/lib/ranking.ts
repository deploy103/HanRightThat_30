import type { Booth } from '../../shared/types';

export type RankTier = 'gold' | 'silver' | 'bronze' | 'normal';

export interface RankedBooth {
  booth: Booth;
  /** 1부터 시작하는 순위 (동률이면 같은 순위) */
  rank: number;
  tier: RankTier;
  /** 1위 금액 대비 비율 (0~1) */
  ratio: number;
}

const TIER_BY_RANK: Record<number, RankTier> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

export const TIER_COLOR: Record<RankTier, string> = {
  gold: 'var(--rank-gold)',
  silver: 'var(--rank-silver)',
  bronze: 'var(--rank-bronze)',
  normal: 'var(--rank-default)',
};

export const TIER_LABEL: Record<RankTier, string> = {
  gold: '1위',
  silver: '2위',
  bronze: '3위',
  normal: '',
};

/**
 * 모금액 내림차순 정렬 후 순위를 매긴다.
 * 동률은 같은 순위를 갖고, 정렬은 안정적이어야 하므로 동률일 때 기존 순서를 유지한다.
 */
export function rankBooths(booths: Booth[]): RankedBooth[] {
  const sorted = [...booths].sort((a, b) => b.amount - a.amount);
  const top = sorted[0]?.amount ?? 0;

  let lastAmount: number | null = null;
  let lastRank = 0;

  return sorted.map((booth, index) => {
    const rank = lastAmount === booth.amount ? lastRank : index + 1;
    lastAmount = booth.amount;
    lastRank = rank;
    return {
      booth,
      rank,
      tier: TIER_BY_RANK[rank] ?? 'normal',
      ratio: top > 0 ? booth.amount / top : 0,
    };
  });
}

export function sumAmount(booths: Booth[]): number {
  return booths.reduce((total, booth) => total + booth.amount, 0);
}

/**
 * Figma 규격: clipWidth = max(30px, amount / firstAmount * 800px)
 * 반응형에서는 레인 폭 비율로 환산해 쓰므로 픽셀 계산은 이 함수가 기준이 된다.
 */
export function clipWidthPx(ratio: number, lane = 800): number {
  return Math.max(30, Math.min(1, Math.max(0, ratio)) * lane);
}
