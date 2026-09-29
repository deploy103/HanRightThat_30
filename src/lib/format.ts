const wonFormatter = new Intl.NumberFormat('ko-KR');

/** 1234567 -> "1,234,567", -100000 -> "-100,000" */
export function formatWon(amount: number): string {
  return wonFormatter.format(Math.round(amount));
}

/** 1 -> "01" */
export function padRank(rank: number): string {
  return String(rank).padStart(2, '0');
}
