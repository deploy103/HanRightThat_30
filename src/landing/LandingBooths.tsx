import { useEffect, useRef, useState } from 'react';
import type { Booth } from '../../shared/types';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { isPlainLeftClick } from '../hooks/useRoute';
import { LandingSectionHeading } from './LandingSectionHeading';

interface Props {
  booths: Booth[];
  navigate: (path: string, options?: { replace?: boolean }) => void;
}

/**
 * 기본 미리보기 개수. "기본 8개" 요구사항을 지키기 위한 값일 뿐 하드코딩된 상한이 아니다 —
 * 부스가 늘어나면 "전체 부스 보기" 버튼으로 격자에서 전부 볼 수 있다.
 */
const DEFAULT_PREVIEW_COUNT = 8;

function BoothCard({ booth, navigate }: { booth: Booth; navigate: Props['navigate'] }) {
  const href = `/play/map?booth=${encodeURIComponent(booth.id)}`;
  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event)) return;
    event.preventDefault();
    navigate(href);
  };
  return (
    <a className="landing-booth-card" href={href} onClick={onClick}>
      {booth.imagePath ? (
        <img
          className="landing-booth-image"
          src={booth.imagePath}
          alt={booth.imageAlt || ''}
          width={320}
          height={200}
          loading="lazy"
        />
      ) : (
        <div className="landing-booth-image landing-booth-fallback" aria-hidden="true" />
      )}
      <div className="landing-booth-body">
        <div className="landing-booth-head">
          <strong>{booth.name}</strong>
          {!booth.isActive ? <span className="pill pill-ended">운영 종료</span> : null}
        </div>
        <p className="landing-booth-meta">
          {booth.team} · {booth.place ?? `${booth.floor}층`}
        </p>
        {booth.summary ? <p className="landing-booth-summary">{booth.summary}</p> : null}
        <span className="landing-booth-link">지도에서 보기 →</span>
      </div>
    </a>
  );
}

export function LandingBooths({ booths, navigate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const { ref, revealed } = useScrollReveal<HTMLElement>();

  const preview = booths.slice(0, DEFAULT_PREVIEW_COUNT);

  function updateEdges() {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }

  useEffect(() => {
    updateEdges();
  }, [booths.length, expanded]);

  function scrollByCard(direction: -1 | 1) {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.landing-booth-card');
    const step = (card?.offsetWidth ?? 260) + 18;
    el.scrollBy({ left: step * direction, behavior: 'smooth' });
  }

  return (
    <section
      id="booths"
      ref={ref}
      className={`landing-section landing-reveal${revealed ? ' is-revealed' : ''}`}
    >
      <div className="wrap">
        <LandingSectionHeading
          index="02"
          eyebrow="부스"
          title="부스 미리보기"
          action={
            booths.length > DEFAULT_PREVIEW_COUNT ? (
              <button type="button" className="btn-secondary" onClick={() => setExpanded((v) => !v)}>
                {expanded ? '캐러셀로 보기' : `전체 부스 보기 (${booths.length})`}
              </button>
            ) : undefined
          }
        />

        {booths.length === 0 ? (
          <p className="empty">부스 정보를 준비하고 있습니다.</p>
        ) : expanded ? (
          <div className="landing-booth-grid">
            {booths.map((booth) => (
              <BoothCard key={booth.id} booth={booth} navigate={navigate} />
            ))}
          </div>
        ) : (
          <div className="landing-carousel">
            <button
              type="button"
              className="landing-carousel-arrow landing-carousel-arrow-prev"
              onClick={() => scrollByCard(-1)}
              disabled={atStart}
              aria-label="이전 부스"
            >
              ‹
            </button>
            <div
              className="landing-carousel-track landing-booth-grid landing-booth-grid-scroll"
              ref={trackRef}
              onScroll={updateEdges}
              role="group"
              aria-label="부스 미리보기 (좌우로 넘겨서 더 볼 수 있습니다)"
            >
              {preview.map((booth) => (
                <BoothCard key={booth.id} booth={booth} navigate={navigate} />
              ))}
            </div>
            <button
              type="button"
              className="landing-carousel-arrow landing-carousel-arrow-next"
              onClick={() => scrollByCard(1)}
              disabled={atEnd}
              aria-label="다음 부스"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
