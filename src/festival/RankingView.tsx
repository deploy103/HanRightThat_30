import { useMemo } from 'react';
import type { Booth, FestivalMeta } from '../../shared/types';
import { PanelHeading } from '../components/PanelHeading';
import { formatWon } from '../lib/format';
import { rankBooths, sumAmount, TIER_COLOR } from '../lib/ranking';
import { RankingRow } from './RankingRow';

interface Props {
  booths: Booth[];
  meta: FestivalMeta;
}

const TICKS = [0, 25, 50, 75];
const LEGEND = [
  { tier: 'gold', label: '1위' },
  { tier: 'silver', label: '2위' },
  { tier: 'bronze', label: '3위' },
  { tier: 'normal', label: '4위 이하' },
] as const;

export function RankingView({ booths, meta }: Props) {
  const ranked = useMemo(() => rankBooths(booths), [booths]);
  const total = useMemo(() => sumAmount(booths), [booths]);
  const top = ranked[0]?.booth.amount ?? 0;

  return (
    <>
      <PanelHeading title="부스 모금" accent="순위" note={meta.updated} />

      {ranked.length === 0 ? (
        <p className="empty">등록된 부스가 없습니다. 관리 화면에서 부스를 추가해 주세요.</p>
      ) : (
        <>
          <div className="deckhead">
            <span className="led" />
            <span className="deckhead-total">{formatWon(total)}원</span>
            <span className="deckhead-meta">
              {meta.goal > 0 ? (
                <>
                  목표 {formatWon(meta.goal)}원 중 <b>{Math.round((total / meta.goal) * 100)}%</b>
                </>
              ) : (
                <>
                  부스 <b>{ranked.length}</b>개 합계
                </>
              )}
            </span>
            <ul className="rank-legend">
              {LEGEND.map((item) => (
                <li key={item.tier}>
                  <span className="legend-dot" style={{ background: TIER_COLOR[item.tier] }} />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="ruler" aria-hidden="true">
            <span className="ruler-label">CH</span>
            <div className="ruler-ticks">
              {TICKS.map((value) => (
                <span key={value} style={{ left: `${value}%` }}>
                  {formatWon(Math.round((top * value) / 100))}
                </span>
              ))}
            </div>
            <span className="ruler-label ruler-label-right">모금액</span>
          </div>

          <div className="track-list">
            {ranked.map((entry) => (
              <RankingRow key={entry.booth.id} entry={entry} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
