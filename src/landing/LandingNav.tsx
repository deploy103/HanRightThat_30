import { useState } from 'react';
import { isPlainLeftClick } from '../hooks/useRoute';

interface Props {
  festivalName: string;
  onEnterFestival: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

const ANCHORS = [
  { href: '#theme', label: '축제 소개' },
  { href: '#booths', label: '부스' },
  { href: '#shows', label: '공연' },
  { href: '#schedule', label: '전체 일정' },
  { href: '#info', label: '이용 안내' },
  { href: '#announcements', label: '공지' },
];

/** 소개 페이지 전용 상단 네비게이션. /play 화면의 FestivalHeader와는 별개 컴포넌트다. */
export function LandingNav({ festivalName, onEnterFestival }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <header className="landing-nav">
      <div className="wrap landing-nav-inner">
        <a
          className="landing-nav-brand"
          href="#top"
          onClick={(event) => {
            if (!isPlainLeftClick(event)) return;
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setOpen(false);
          }}
        >
          {festivalName}
        </a>

        <button
          type="button"
          className="landing-nav-toggle"
          aria-expanded={open}
          aria-controls="landing-nav-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">메뉴 {open ? '닫기' : '열기'}</span>
          <span aria-hidden="true">{open ? '✕' : '☰'}</span>
        </button>

        <nav id="landing-nav-menu" className={`landing-nav-menu${open ? ' is-open' : ''}`} aria-label="소개 페이지">
          {ANCHORS.map((item) => (
            <a key={item.href} href={item.href} className="landing-nav-link" onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
          <a className="landing-nav-cta" href="/play/map" onClick={onEnterFestival}>
            축제 들어가기
          </a>
        </nav>
      </div>
    </header>
  );
}
