import { useState } from 'react';
import { FestivalFooter } from '../components/FestivalFooter';
import { FestivalHeader } from '../components/FestivalHeader';
import { FestivalTabs, TABS, type TabId } from '../components/FestivalTabs';
import { useFestival } from '../hooks/useFestival';
import { MapView } from './MapView';
import { RankingView } from './RankingView';
import { ScheduleView } from './ScheduleView';

/** 관리자가 값을 고치면 공개 화면도 따라오도록 주기적으로 다시 읽는다. */
const POLL_MS = 8000;

export function FestivalApp() {
  const [tab, setTab] = useState<TabId>('rank');
  const { data, loading, error } = useFestival(POLL_MS);

  return (
    <>
      <FestivalHeader title="제30회 한빛제" lede="부스 모금 현황 · 부스 위치 · 공연 순서" />
      <FestivalTabs active={tab} onChange={setTab} />

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
                {item.id === 'rank' ? (
                  <RankingView
                    rankings={data.rankings}
                    rankingsPublic={data.rankingsPublic}
                    total={data.total}
                    meta={data.meta}
                  />
                ) : null}
                {item.id === 'map' ? <MapView booths={data.booths} /> : null}
                {item.id === 'show' ? <ScheduleView shows={data.shows} meta={data.meta} /> : null}
              </section>
            ))
          : null}
      </main>

      <FestivalFooter />
    </>
  );
}
