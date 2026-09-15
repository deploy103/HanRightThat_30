import { FestivalApp } from './festival/FestivalApp';

/** 관리 화면은 별도 저장소(HanRightThat_30_admin)로 분리되어 이 앱은 공개 조회 화면만 서빙한다. */
export function App() {
  return <FestivalApp />;
}
