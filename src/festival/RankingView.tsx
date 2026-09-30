import type { RankedBooth } from '../../shared/ranking';
import { TIER_COLOR } from '../../shared/ranking';
import type { FestivalMeta } from '../../shared/types';
import { PanelHeading } from '../components/PanelHeading';
import { formatWon } from '../lib/format';
import { RankingRow } from './RankingRow';

interface Props {
  rankings: RankedBooth[];
  rankingsPublic: boolean;
  /** 순위 비공개 시 null (비공개 화면에서는 쓰지 않는다). */
  total: number | null;
  meta: FestivalMeta;
}

const TICKS = [0, 25, 50, 75];
const LEGEND = [
  { tier: 'gold', label: '1위' },
  { tier: 'silver', label: '2위' },
  { tier: 'bronze', label: '3위' },
  { tier: 'normal', label: '4위 이하' },
] as const;

/** 순위는 항상 서버가 계산해 내려준다 — 이 컴포넌트는 렌더링만 담당한다. */
export function RankingView({ rankings, rankingsPublic, total: totalOrNull, meta }: Props) {
  // 공개 상태에서는 서버가 항상 합계를 채워 보낸다. null 은 비공개일 때뿐이고 그때는 아래에서 그리지 않는다.
  const total = totalOrNull ?? 0;
  // 모금액이 음수(시작 준비금)일 수 있으므로 눈금 기준은 0 이상으로 둔다.
  const top = Math.max(0, rankings[0]?.booth.amount ?? 0);

  return (
    <>
      <PanelHeading title="부스 모금" accent="순위" note={meta.updated} />

      {!rankingsPublic ? (
        <p className="empty">현재 순위는 비공개 상태입니다.</p>
      ) : rankings.length === 0 ? (
        <p className="empty">등록된 부스가 없습니다.</p>
      ) : (
        <>
          <div className="deckhead">
            <span className="led" />
            <span className="deckhead-total">{formatWon(total)}원</span>
            <span className="deckhead-meta">
              {meta.goal > 0 ? (
                <>
                  목표 {formatWon(meta.goal)}원 중 <b>{Math.max(0, Math.round((total / meta.goal) * 100))}%</b>
                </>
              ) : (
                <>
                  부스 <b>{rankings.length}</b>개 합계
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
            {rankings.map((entry) => (
              <RankingRow key={entry.booth.id} entry={entry} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
