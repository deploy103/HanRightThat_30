import type { Show } from '../../shared/types';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { isPlainLeftClick } from '../hooks/useRoute';
import { LandingSectionHeading } from './LandingSectionHeading';

interface Props {
  shows: Show[];
  navigate: (path: string, options?: { replace?: boolean }) => void;
}

const PREVIEW_COUNT = 3;

export function LandingShows({ shows, navigate }: Props) {
  const ordered = [...shows].sort((a, b) => a.order - b.order).slice(0, PREVIEW_COUNT);
  const { ref, revealed } = useScrollReveal<HTMLElement>();

  const goToSchedule = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event)) return;
    event.preventDefault();
    navigate('/play/schedule');
  };

  return (
    <section
      id="shows"
      ref={ref}
      className={`landing-section landing-reveal${revealed ? ' is-revealed' : ''}`}
    >
      <div className="wrap">
        <LandingSectionHeading
          index="03"
          eyebrow="공연"
          title="공연 미리보기"
          action={
            <a className="btn-secondary" href="/play/schedule" onClick={goToSchedule}>
              전체 공연 순서 보기
            </a>
          }
        />

        {ordered.length === 0 ? (
          <p className="empty">공연 정보 준비 중입니다.</p>
        ) : (
          <ol className="landing-show-list">
            {ordered.map((show, i) => (
              <li key={show.id} className="landing-show-row">
                <span className="landing-show-index">{i + 1}</span>
                <span className="landing-show-time">{show.time}</span>
                <span className="landing-show-body">
                  <span className="landing-show-title">{show.title}</span>
                  <span className="landing-show-team">
                    {show.team}
                    {show.genre ? <em className="landing-show-genre">{show.genre}</em> : null}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
