import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './useAutoRotate';

/**
 * 섹션이 뷰포트에 들어오면 한 번만 살짝 떠오르는 연출을 위한 훅.
 * 장식 모션이므로 prefers-reduced-motion에서는 처음부터 보인 상태로 둔다(추가 관찰 없음).
 */
export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -64px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return { ref, revealed };
}
