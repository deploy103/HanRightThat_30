import { FestivalFooter } from '../components/FestivalFooter';
import { FestivalHeader, type HeroFact } from '../components/FestivalHeader';
import { FestivalTabs, TABS, type TabId } from '../components/FestivalTabs';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useFestival } from '../hooks/useFestival';
import { isPlainLeftClick, PLAY_TAB_PATH } from '../hooks/useRoute';
import { formatWon } from '../lib/format';
import { MapView } from './MapView';
import { RankingView } from './RankingView';
import { ScheduleView } from './ScheduleView';

/** 관리자가 값을 고치면 공개 화면도 따라오도록 주기적으로 다시 읽는다. */
const POLL_MS = 8000;

interface Props {
  tab: TabId;
  boothId?: string;
  navigate: (path: string, options?: { replace?: boolean }) => void;
}

export function FestivalApp({ tab, boothId, navigate }: Props) {
  const { data, loading, error } = useFestival(POLL_MS);

  useDocumentMeta(`제30회 한빛제 · ${TABS.find((item) => item.id === tab)?.title ?? ''}`);

  const goToIntro = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event)) return;
    event.preventDefault();
    navigate('/');
  };

  const facts: HeroFact[] | undefined = data
    ? [
        { label: '공연 장소', value: data.meta.stage },
        // 순위가 비공개 상태일 때는 모금액도 함께 숨겨 관리자의 비공개 설정과 어긋나지 않게 한다.
        ...(data.rankingsPublic ? [{ label: '모금 현황', value: `${formatWon(data.total)}원` }] : []),
        { label: '갱신', value: data.meta.updated },
      ]
    : undefined;

  return (
    <>
      <div className="wrap play-breadcrumb">
        <a href="/" onClick={goToIntro}>
          ← 축제 소개
        </a>
      </div>
      <FestivalHeader
        eyebrow="제30회"
        heading="한빛제"
        lede="부스 모금 현황 · 부스 위치 · 공연 순서"
        facts={facts}
      />
      <FestivalTabs active={tab} onChange={(id) => navigate(PLAY_TAB_PATH[id])} />

      <main className="wrap main-panels">
        {loading ? <p className="empty">불러오는 중…</p> : null}
        {error ? <p className="empty empty-error">{error}</p> : null}

        {data
          ? TABS.map((item) => (
              <section
                key={item.id}
                className="panel"
                id={`panel-${item.id}`}
                role="tabpanel"
                aria-labelledby={`tab-${item.id}`}
                tabIndex={-1}
                hidden={tab !== item.id}
              >
                {item.id === 'ranking' ? (
                  <RankingView
                    rankings={data.rankings}
                    rankingsPublic={data.rankingsPublic}
                    total={data.total}
                    meta={data.meta}
                  />
                ) : null}
                {item.id === 'map' ? <MapView booths={data.booths} initialBoothId={boothId} /> : null}
                {item.id === 'schedule' ? <ScheduleView shows={data.shows} meta={data.meta} /> : null}
              </section>
            ))
          : null}
      </main>

      <FestivalFooter />
    </>
  );
}
