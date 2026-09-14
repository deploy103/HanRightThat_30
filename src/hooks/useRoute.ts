import { useCallback, useEffect, useState } from 'react';

/**
 * 공개 화면(/)과 관리 화면(/admin) 두 개만 있으므로 라우팅 라이브러리 없이 처리한다.
 */
export function useRoute(): { path: string; navigate: (to: string) => void } {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    window.history.pushState({}, '', to);
    setPath(to);
    window.scrollTo({ top: 0 });
  }, []);

  return { path, navigate };
}
