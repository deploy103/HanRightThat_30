import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type PublicLanding } from '../lib/api';

export interface LandingState {
  data: PublicLanding | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 소개 콘텐츠는 관리자가 게시할 때만 바뀌므로 useFestival 처럼 주기적으로 조회하지 않는다.
 * 최초 실패는 에러+재시도로, 이후 갱신 실패는 이전 성공 데이터를 유지한 채 에러만 별도로 알린다.
 */
export function useLanding(): LandingState {
  const [data, setData] = useState<PublicLanding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await api.getLanding();
      if (!mounted.current) return;
      setData(next);
      setError(null);
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof Error ? cause.message : '소개 콘텐츠를 불러오지 못했습니다.');
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

  return { data, loading, error, refresh };
}
