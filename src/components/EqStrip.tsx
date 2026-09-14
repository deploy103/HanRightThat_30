import { useMemo } from 'react';

const WIDTH = 1000;
const HEIGHT = 140;
const BAR = 21;
const GAP = 6;
const CELL = 6;
const CELL_GAP = 4;
const COLORS = ['var(--acid)', 'var(--cyan)', 'var(--hot)', 'var(--violet)'];

/** 헤더의 EQ(이퀄라이저) 그래픽. 세그먼트 마스크 + 삼각형 막대. */
export function EqStrip() {
  const rows = useMemo(() => {
    const list: number[] = [];
    for (let y = 0; y < HEIGHT; y += CELL + CELL_GAP) list.push(y);
    return list;
  }, []);

  const bars = useMemo(() => {
    const count = Math.floor(WIDTH / (BAR + GAP));
    const pad = (WIDTH - (count * BAR + (count - 1) * GAP)) / 2;
    return Array.from({ length: count }, (_, i) => {
      const x = pad + i * (BAR + GAP);
      return {
        points: `${x + BAR / 2},0 ${x + BAR},${HEIGHT} ${x},${HEIGHT}`,
        fill: COLORS[i % COLORS.length],
        duration: `${(0.62 + (i % 6) * 0.19).toFixed(2)}s`,
        delay: `-${((i % 9) * 0.11).toFixed(2)}s`,
      };
    });
  }, []);

  return (
    <div className="eq-strip">
      <svg
        className="eq-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <mask id="eq-seg" maskUnits="userSpaceOnUse" x="0" y="0" width={WIDTH} height={HEIGHT}>
            <rect width={WIDTH} height={HEIGHT} fill="#000" />
            <g fill="#fff">
              {rows.map((y) => (
                <rect key={y} x={0} y={y} width={WIDTH} height={CELL} />
              ))}
            </g>
          </mask>
        </defs>
        <g mask="url(#eq-seg)">
          {bars.map((bar) => (
            <polygon
              key={bar.points}
              className="eq-bar"
              points={bar.points}
              fill={bar.fill}
              style={{ animationDuration: bar.duration, animationDelay: bar.delay }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
