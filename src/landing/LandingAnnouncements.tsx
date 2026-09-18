import { useState } from 'react';
import type { Announcement } from '../../shared/types';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { LandingSectionHeading } from './LandingSectionHeading';

interface Props {
  announcements: Announcement[];
}

const PREVIEW_COUNT = 3;
const RECENT_WINDOW_MS = 1000 * 60 * 60 * 24 * 3; // 3일

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium' }).format(date);
}

/** 게시된 공지만 이 컴포넌트에 전달되어야 한다 (필터링은 API/상위에서 끝나 있어야 한다). */
export function LandingAnnouncements({ announcements }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { ref, revealed } = useScrollReveal<HTMLElement>();
  const ordered = [...announcements].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const visible = expanded ? ordered : ordered.slice(0, PREVIEW_COUNT);
  const now = Date.now();

  if (ordered.length === 0) {
    return (
      <section
        id="announcements"
        ref={ref}
        className={`landing-section landing-reveal${revealed ? ' is-revealed' : ''}`}
      >
        <div className="wrap">
          <LandingSectionHeading index="06" eyebrow="공지" title="공지" />
          <p className="empty">등록된 공지가 없습니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="announcements"
      ref={ref}
      className={`landing-section landing-reveal${revealed ? ' is-revealed' : ''}`}
    >
      <div className="wrap">
        <LandingSectionHeading index="06" eyebrow="공지" title="공지" />

        <div className="landing-announcement-list">
          {visible.map((item) => {
            const isRecent = now - new Date(item.updatedAt).getTime() < RECENT_WINDOW_MS;
            return (
              <details key={item.id} className="landing-announcement-item">
                <summary>
                  <span className="landing-announcement-title">
                    {isRecent ? <span className="led" aria-hidden="true" /> : null}
                    {item.title}
                  </span>
                  <span className="landing-announcement-date">{formatDate(item.updatedAt)}</span>
                </summary>
                <p>{item.body}</p>
              </details>
            );
          })}
        </div>

        {ordered.length > PREVIEW_COUNT ? (
          <button type="button" className="btn-secondary" onClick={() => setExpanded((value) => !value)}>
            {expanded ? '접기' : `전체 공지 보기 (${ordered.length})`}
          </button>
        ) : null}
      </div>
    </section>
  );
}
