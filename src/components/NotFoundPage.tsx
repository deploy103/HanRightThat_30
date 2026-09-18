import { useEffect } from 'react';
import { isPlainLeftClick } from '../hooks/useRoute';

interface Props {
  navigate: (path: string, options?: { replace?: boolean }) => void;
}

/** 알 수 없는 공개 경로에 대한 화면. API 경로는 서버가 별도로 JSON 404를 반환한다. */
export function NotFoundPage({ navigate }: Props) {
  useEffect(() => {
    document.title = '페이지를 찾을 수 없습니다 · 한빛제';
  }, []);

  const go = (path: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event)) return;
    event.preventDefault();
    navigate(path);
  };

  return (
    <main className="wrap not-found">
      <span className="badge">
        <span>404</span>
      </span>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p className="lede">주소를 다시 확인하거나 아래에서 이동해 주세요.</p>
      <div className="not-found-actions">
        <a className="btn-primary" href="/" onClick={go('/')}>
          축제 소개로
        </a>
        <a className="btn-secondary" href="/play/map" onClick={go('/play/map')}>
          지도 바로가기
        </a>
      </div>
    </main>
  );
}
