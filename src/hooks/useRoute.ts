import { useCallback, useEffect, useState } from 'react';

export type PlayTab = 'map' | 'ranking' | 'schedule';

export type Route =
  | { name: 'landing' }
  | { name: 'play'; tab: PlayTab; boothId?: string }
  | { name: 'not-found' };

function parsePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname || '/';
}

/**
 * 이 프로젝트는 페이지가 소개/현장 두 갈래뿐이라 react-router 같은 라이브러리를 새로 들이지 않고
 * pushState/popstate 기반 최소 라우터만 둔다 (AGENTS.md "필요 없는 라이브러리를 추가하지 않는다").
 */
export function parseRoute(pathname: string, search: string): Route {
  const path = parsePath(pathname);
  if (path === '/') return { name: 'landing' };
  // /play 단독 진입은 지도로 취급한다 — App이 마운트 후 URL을 /play/map 으로 교체한다.
  if (path === '/play' || path === '/play/map') {
    const boothId = new URLSearchParams(search).get('booth') ?? undefined;
    return { name: 'play', tab: 'map', boothId };
  }
  if (path === '/play/ranking') return { name: 'play', tab: 'ranking' };
  if (path === '/play/schedule') return { name: 'play', tab: 'schedule' };
  return { name: 'not-found' };
}

export interface UseRouteResult {
  route: Route;
  path: string;
  navigate: (path: string, options?: { replace?: boolean }) => void;
}

export function useRoute(): UseRouteResult {
  const [path, setPath] = useState(() => window.location.pathname + window.location.search);
  const route = parseRoute(window.location.pathname, window.location.search);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((nextPath: string, options?: { replace?: boolean }) => {
    if (options?.replace) window.history.replaceState(null, '', nextPath);
    else window.history.pushState(null, '', nextPath);
    setPath(window.location.pathname + window.location.search);
  }, []);

  return { route, path, navigate };
}

/** 새 탭/다운로드/컨텍스트 메뉴로 열려는 클릭은 그대로 두고, 순수 좌클릭만 SPA 라우팅으로 가로챈다. */
export function isPlainLeftClick(event: React.MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export const PLAY_TAB_PATH: Record<PlayTab, string> = {
  map: '/play/map',
  ranking: '/play/ranking',
  schedule: '/play/schedule',
};
