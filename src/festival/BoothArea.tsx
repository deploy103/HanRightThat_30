import { toRect } from '../../shared/floorPlans';
import type { Booth } from '../../shared/types';

interface Props {
  booth: Booth;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * 배치도 위의 부스 영역 (읽기 전용 렌더러).
 *
 * 위치·크기는 모두 배치도 대비 % 라서 컨테이너가 커지든 작아지든 같은 자리에 그려진다 —
 * PC/태블릿/모바일에서 좌표가 어긋나지 않는 이유다.
 * 관리자 편집기도 똑같은 toRect() 계산을 쓴다.
 */
export function BoothArea({ booth, index, selected, onSelect }: Props) {
  const rect = toRect(booth.position, booth.size);

  return (
    <button
      type="button"
      className={`booth-area${selected ? ' is-selected' : ''}${booth.isActive ? '' : ' is-ended'}`}
      style={{
        left: `${rect.left}%`,
        top: `${rect.top}%`,
        width: `${rect.width}%`,
        height: `${rect.height}%`,
      }}
      aria-pressed={selected}
      onClick={() => onSelect(booth.id)}
    >
      <span className="booth-area-index">{index + 1}</span>
      <span className="booth-area-name">{booth.name}</span>
    </button>
  );
}
