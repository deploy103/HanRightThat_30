const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** startsAt/endsAt(ISO, 시간대 오프셋 포함)을 Asia/Seoul 기준으로 사람이 읽는 문구로 만든다. */
export function formatFestivalPeriod(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return '일정 준비 중';
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return '일정 준비 중';

  const startText = `${dateFormatter.format(start)} ${timeFormatter.format(start)}`;
  if (!endsAt) return startText;

  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return startText;

  const sameDay = dateFormatter.format(start) === dateFormatter.format(end);
  if (sameDay) return `${startText} ~ ${timeFormatter.format(end)}`;
  return `${startText} ~ ${dateFormatter.format(end)} ${timeFormatter.format(end)}`;
}
