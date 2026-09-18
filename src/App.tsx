import { useEffect } from 'react';
import { NotFoundPage } from './components/NotFoundPage';
import { FestivalApp } from './festival/FestivalApp';
import { useRoute } from './hooks/useRoute';
import { LandingPage } from './landing/LandingPage';

/** 관리 화면은 별도 저장소(HanRightThat_30_admin)로 분리되어 이 앱은 공개 조회 화면만 서빙한다. */
export function App() {
  const { route, navigate } = useRoute();

  // /play 단독 진입은 지도로 취급해 렌더하지만, 주소창은 /play/map 으로 맞춰 둔다
  // (새로고침·뒤로가기·URL 복사 모두 /play/map 기준으로 일관되게 동작하도록).
  useEffect(() => {
    if (window.location.pathname === '/play') navigate('/play/map', { replace: true });
  }, [navigate]);

  if (route.name === 'landing') return <LandingPage navigate={navigate} />;
  if (route.name === 'play') return <FestivalApp tab={route.tab} boothId={route.boothId} navigate={navigate} />;
  return <NotFoundPage navigate={navigate} />;
}
