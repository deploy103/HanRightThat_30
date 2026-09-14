/** 문자열 -> 정수 해시. 같은 부스는 항상 같은 파형을 갖게 하기 위한 seed. */
export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % 10000);
}

function pseudoRandom(index: number, seed: number): number {
  const x = Math.sin(index * 91.7 + seed * 57.3) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * DAW 오디오 클립 파형 path. 렌더마다 모양이 바뀌지 않도록 seed 기반으로 계산한다.
 * viewBox 는 0 0 width height 로 사용한다.
 */
export function waveformPath(seed: number, bars: number, width: number, height: number): string {
  const mid = height / 2;
  const count = Math.max(4, Math.round(bars));
  let path = '';
  for (let i = 0; i < count; i += 1) {
    const x = ((i + 0.5) * width) / count;
    const amplitude = pseudoRandom(i, seed) * 0.62 + pseudoRandom(Math.floor(i / 4), seed) * 0.38;
    const h = (0.12 + amplitude * 0.88) * (mid - 2);
    path += `M${x.toFixed(1)},${(mid - h).toFixed(1)}L${x.toFixed(1)},${(mid + h).toFixed(1)}`;
  }
  return path;
}

export interface WaveformBar {
  x: number;
  y1: number;
  y2: number;
  /** CSS 애니메이션 duration(초). 막대마다 살짝 달라야 자연스럽게 움직인다. */
  duration: number;
  /** 음수 delay 로 시작 시점을 어긋나게 해 동시에 뛰지 않게 한다. */
  delay: number;
}

/**
 * 막대별 위치 + 애니메이션 타이밍. seed 기반이라 같은 부스는 항상 같은 값을 낸다
 * (렌더마다 값 자체가 바뀌진 않음 - 화면에서 움직이는 건 CSS 애니메이션).
 */
export function waveformBars(seed: number, bars: number, width: number, height: number): WaveformBar[] {
  const mid = height / 2;
  const count = Math.max(4, Math.round(bars));
  const list: WaveformBar[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = ((i + 0.5) * width) / count;
    const amplitude = pseudoRandom(i, seed) * 0.62 + pseudoRandom(Math.floor(i / 4), seed) * 0.38;
    const h = (0.12 + amplitude * 0.88) * (mid - 2);
    const duration = 0.55 + pseudoRandom(i + 137, seed) * 0.75;
    const delay = -pseudoRandom(i + 271, seed) * duration;
    list.push({ x, y1: mid - h, y2: mid + h, duration, delay });
  }
  return list;
}
