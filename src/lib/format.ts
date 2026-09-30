const wonFormatter = new Intl.NumberFormat('ko-KR');

/** 1234567 -> "1,234,567", -100000 -> "-100,000" */
export function formatWon(amount: number): string {
  return wonFormatter.format(Math.round(amount));
}

/** 부스 금액 표시. 순위 비공개로 서버가 금액을 비워 보냈으면(null) "비공개" 로 표시한다. */
export function formatBoothAmount(amount: number | null): string {
  return amount === null ? '비공개' : `${formatWon(amount)}원`;
}

/** 1 -> "01" */
export function padRank(rank: number): string {
  return String(rank).padStart(2, '0');
}
