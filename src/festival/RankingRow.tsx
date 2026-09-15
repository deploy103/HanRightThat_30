import { useMemo } from 'react';
import { formatWon, padRank } from '../lib/format';
import { clipWidthPx, TIER_COLOR, TIER_LABEL, type RankedBooth } from '../../shared/ranking';
import { hashSeed, waveformBars } from '../lib/waveform';

const WAVE_WIDTH = 600;
const WAVE_HEIGHT = 42;

interface Props {
  entry: RankedBooth;
}

export function RankingRow({ entry }: Props) {
  const { booth, rank, tier, ratio } = entry;
  const color = TIER_COLOR[tier];

  const wave = useMemo(() => {
    const width = clipWidthPx(ratio);
    const bars = Math.max(6, Math.round(width / 7));
    return {
      bars: waveformBars(hashSeed(booth.id), bars, WAVE_WIDTH, WAVE_HEIGHT),
      strokeWidth: ((WAVE_WIDTH / bars) * 0.62).toFixed(2),
    };
  }, [booth.id, ratio]);

  return (
    <div className={`track track-${tier}`}>
      <div className="track-num" style={{ background: color }}>
        {padRank(rank)}
      </div>
      <div className="lane">
        <div className="track-info">
          <strong>{booth.name}</strong>
          <em>{booth.team}</em>
          {TIER_LABEL[tier] ? (
            <span className="tier-flag" style={{ color }}>
              {TIER_LABEL[tier]}
            </span>
          ) : null}
        </div>
        <div
          className="clip"
          style={{
            // Figma 규격: max(30px, 금액비율 × 레인 폭)
            width: `max(30px, ${(ratio * 100).toFixed(2)}%)`,
            borderColor: color,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
          }}
        >
          <svg
            className="clip-wave"
            viewBox={`0 0 ${WAVE_WIDTH} ${WAVE_HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            {wave.bars.map((bar, index) => (
              <line
                key={index}
                className="wave-bar"
                x1={bar.x}
                y1={bar.y1}
                x2={bar.x}
                y2={bar.y2}
                stroke={color}
                strokeWidth={wave.strokeWidth}
                shapeRendering="crispEdges"
                style={{
                  animationDuration: `${bar.duration.toFixed(2)}s`,
                  animationDelay: `${bar.delay.toFixed(2)}s`,
                }}
              />
            ))}
          </svg>
        </div>
      </div>
      <div className="track-value">
        {formatWon(booth.amount)}
        <small>원</small>
      </div>
    </div>
  );
}
