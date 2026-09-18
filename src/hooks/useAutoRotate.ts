import { useEffect, useState } from 'react';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduced(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}

export interface AutoRotateState {
  index: number;
  setIndex: (index: number) => void;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  reducedMotion: boolean;
}

/**
 * 히어로 슬라이드용 최소 자동 회전 훅. 장식 모션이 아니라 실제 정보(주제/일시/장소)를 담고 있어서
 * 자동 재생에도 반드시 정지 수단을 함께 둔다 — prefers-reduced-motion에서는 아예 자동 회전하지 않는다.
 */
export function useAutoRotate(length: number, intervalMs: number): AutoRotateState {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (length <= 1 || paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [length, intervalMs, paused, reducedMotion]);

  useEffect(() => {
    if (index >= length) setIndex(0);
  }, [length, index]);

  return { index, setIndex, paused, setPaused, reducedMotion };
}
