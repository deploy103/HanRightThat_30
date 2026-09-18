import type { ScheduleItem } from '../../shared/types';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { LandingSectionHeading } from './LandingSectionHeading';

interface Props {
  scheduleItems: ScheduleItem[];
}

/**
 * 개회·부스 운영·폐회 등 행사 전체 흐름. 공연별 순서표(LandingShows, 번호 붙은 행)와 시각적으로
 * 구분되도록 세로 타임라인으로 그린다.
 */
export function LandingSchedule({ scheduleItems }: Props) {
  const { ref, revealed } = useScrollReveal<HTMLElement>();
  // 저장 순서(등록 순)가 아니라 항상 시간순으로 보여준다 — 서버에 별도 order 필드가 없고
  // time은 항상 HH:MM 형식으로 검증되어 있어 문자열 정렬로 충분하다. Array#sort는 안정 정렬이라
  // 같은 시각의 항목은 등록 순서를 그대로 유지한다(관리자 SchedulePage.tsx와 동일한 규칙).
  const sorted = [...scheduleItems].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <section
      id="schedule"
      ref={ref}
      className={`landing-section landing-reveal${revealed ? ' is-revealed' : ''}`}
    >
      <div className="wrap">
        <LandingSectionHeading index="04" eyebrow="전체 일정" title="축제 전체 일정" />

        {sorted.length === 0 ? (
          <p className="empty">일정 준비 중입니다.</p>
        ) : (
          <ol className="landing-timeline">
            {sorted.map((item) => (
              <li key={item.id} className="landing-timeline-row">
                <span className="landing-timeline-time">{item.time}</span>
                <span className="landing-timeline-dot" aria-hidden="true" />
                <span className="landing-timeline-body">
                  <span className="landing-timeline-title">{item.title}</span>
                  {item.note ? <span className="landing-timeline-note">{item.note}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
