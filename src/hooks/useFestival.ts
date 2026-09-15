import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type PublicFestival } from '../lib/api';

export interface FestivalState {
  data: PublicFestival | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setData: (data: PublicFestival) => void;
}

/**
 * 축제 데이터를 서버에서 읽어온다.
 * pollMs 를 주면 주기적으로/탭 복귀 시 다시 읽어 관리자가 수정한 값이 공개 화면에 반영된다.
 */
export function useFestival(pollMs = 0): FestivalState {
  const [data, setData] = useState<PublicFestival | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await api.getFestival();
      if (!mounted.current) return;
      setData(next);
      setError(null);
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof Error ? cause.message : '데이터를 불러오지 못했습니다.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (pollMs <= 0) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, pollMs);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [pollMs, refresh]);

  return { data, loading, error, refresh, setData };
}
