import { useMemo } from 'react';
import { EqStrip } from '../components/EqStrip';
import type { LandingContent } from '../../shared/types';
import { useAutoRotate } from '../hooks/useAutoRotate';
import { formatFestivalPeriod } from '../lib/datetime';

interface Props {
  content: LandingContent;
  onEnterFestival: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  onGoSchedule: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

interface Slide {
  id: string;
  kicker: string;
  title: string;
  body?: string;
}

const SLIDE_INTERVAL_MS = 6000;

/**
 * 새 편집 필드를 추가하지 않고, 이미 있는 LandingContent 값(첫 화면 문구/주제/일시·장소)만으로
 * 슬라이드 2~3장을 구성한다 — 운영자가 입력할 항목이 늘어나지 않는다.
 */
function buildSlides(content: LandingContent, period: string): Slide[] {
  const slides: Slide[] = [
    {
      id: 'main',
      kicker: `${content.year} · 제${content.edition}회 ${content.festivalName}`,
      title: content.heroTitle,
      body: content.heroDescription || undefined,
    },
  ];
  if (content.themeTitle || content.themeBody) {
    slides.push({
      id: 'theme',
      kicker: `주제 · ${content.theme}`,
      title: content.themeTitle || content.theme,
      body: content.themeBody || undefined,
    });
  }
  slides.push({
    id: 'when',
    kicker: '일시 · 장소',
    title: period,
    body: content.venueName || undefined,
  });
  return slides;
}

export function LandingHero({ content, onEnterFestival, onGoSchedule }: Props) {
  const period = formatFestivalPeriod(content.startsAt, content.endsAt);
  const slides = useMemo(() => buildSlides(content, period), [content, period]);
  const { index, setIndex, paused, setPaused, reducedMotion } = useAutoRotate(slides.length, SLIDE_INTERVAL_MS);

  return (
    <header id="top" className="landing-hero">
      <div
        className="wrap landing-hero-inner"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div className="landing-hero-slides" aria-roledescription="carousel" aria-label="축제 소개">
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              className={`landing-hero-slide${i === index ? ' is-active' : ''}`}
              aria-hidden={i !== index}
              aria-roledescription="slide"
              aria-label={`${i + 1}/${slides.length}`}
            >
              <span className="badge">
                <span>{slide.kicker}</span>
              </span>
              <h1 className="landing-hero-title">{slide.title}</h1>
              {slide.body ? <p className="lede">{slide.body}</p> : null}
            </div>
          ))}
        </div>

        {slides.length > 1 ? (
          <div className="landing-hero-controls">
            <div className="landing-hero-dots" role="tablist" aria-label="슬라이드 선택">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`${i + 1}번째 내용 보기`}
                  className={`landing-hero-dot${i === index ? ' is-active' : ''}`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
            {!reducedMotion ? (
              <button
                type="button"
                className="landing-hero-pause"
                aria-pressed={paused}
                onClick={() => setPaused(!paused)}
              >
                {paused ? '▶ 재생' : '❙❙ 정지'}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="hero-facts">
          <div className="hero-fact">
            <span className="hero-fact-label">일시</span>
            <span className="hero-fact-value">{period}</span>
          </div>
          <div className="hero-fact">
            <span className="hero-fact-label">장소</span>
            <span className="hero-fact-value">{content.venueName || '장소 준비 중'}</span>
          </div>
        </div>

        <div className="landing-hero-actions">
          <a className="btn-primary btn-lg" href="/play/map" onClick={onEnterFestival}>
            축제 들어가기
          </a>
          <a className="btn-secondary btn-lg" href="#schedule">
            전체 일정 보기
          </a>
          <a className="btn-secondary btn-lg" href="/play/schedule" onClick={onGoSchedule}>
            공연 순서 보기
          </a>
        </div>
      </div>
      <EqStrip />
    </header>
  );
}
