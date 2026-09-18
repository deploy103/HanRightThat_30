import { EqStrip } from '../components/EqStrip';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useFestival } from '../hooks/useFestival';
import { useLanding } from '../hooks/useLanding';
import { isPlainLeftClick } from '../hooks/useRoute';
import { LandingAnnouncements } from './LandingAnnouncements';
import { LandingBooths } from './LandingBooths';
import { LandingFooter } from './LandingFooter';
import { LandingHero } from './LandingHero';
import { LandingInfo } from './LandingInfo';
import { LandingNav } from './LandingNav';
import { LandingSchedule } from './LandingSchedule';
import { LandingShows } from './LandingShows';
import { LandingTheme } from './LandingTheme';

interface Props {
  navigate: (path: string, options?: { replace?: boolean }) => void;
}

export function LandingPage({ navigate }: Props) {
  const { data: landing, loading: landingLoading, error: landingError, refresh } = useLanding();
  // 소개 전용 데이터라 8초 주기 조회는 필요 없다 (관리자가 게시할 때만 값이 바뀐다).
  const { data: festival } = useFestival(0);

  const content = landing?.content ?? null;

  useDocumentMeta(
    content ? `${content.year} · 제${content.edition}회 ${content.festivalName}` : '한빛제',
    content?.heroDescription || '부스 모금 순위 · 부스 배치도 · 공연 순서를 한눈에',
    'https://hanwol.site/',
  );

  const goPlay = (path: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event)) return;
    event.preventDefault();
    navigate(path);
  };

  if (landingLoading) {
    return (
      <main className="wrap landing-status">
        <p className="empty">불러오는 중…</p>
      </main>
    );
  }

  if (landingError && !landing) {
    return (
      <main className="wrap landing-status">
        <p className="empty empty-error" role="alert">
          {landingError}
        </p>
        <button type="button" className="btn-secondary" onClick={() => void refresh()}>
          다시 시도
        </button>
      </main>
    );
  }

  if (!content) {
    // 게시된 소개가 아직 없다 — 초안 유무와 관계없이 방문자에게는 최소 준비 화면만 보여준다.
    return (
      <main className="landing-status landing-status-preparing">
        <div className="wrap">
          <span className="badge">
            <span>한빛제</span>
          </span>
          <h1 className="landing-hero-title">축제 소개를 준비하고 있습니다</h1>
          <p className="lede">현장 지도와 공연 순서는 지금도 확인할 수 있습니다.</p>
          <div className="landing-hero-actions">
            <a className="btn-primary btn-lg" href="/play/map" onClick={goPlay('/play/map')}>
              축제 들어가기
            </a>
          </div>
        </div>
        <EqStrip />
      </main>
    );
  }

  return (
    <>
      <LandingNav festivalName={content.festivalName} onEnterFestival={goPlay('/play/map')} />
      <LandingHero content={content} onEnterFestival={goPlay('/play/map')} onGoSchedule={goPlay('/play/schedule')} />
      <LandingTheme content={content} />
      <LandingBooths booths={festival?.booths ?? []} navigate={navigate} />
      <LandingShows shows={festival?.shows ?? []} navigate={navigate} />
      <LandingSchedule scheduleItems={festival?.scheduleItems ?? []} />
      <LandingInfo content={content} />
      <LandingAnnouncements announcements={festival?.announcements ?? []} />
      <LandingFooter content={content} />
    </>
  );
}
