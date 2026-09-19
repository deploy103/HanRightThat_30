import type { FloorId } from '../../shared/types';
import { FLOOR_IDS, FLOOR_PLANS } from '../../shared/floorPlans';

interface Props {
  active: FloorId;
  onChange: (floor: FloorId) => void;
  /** 층별 부스 개수 */
  counts: Record<FloorId, number>;
}

export function FloorSelector({ active, onChange, counts }: Props) {
  return (
    <div className="floor-selector" role="group" aria-label="층 선택">
      {FLOOR_IDS.map((floor) => (
        <button
          key={floor}
          type="button"
          className="floor-tab"
          aria-pressed={active === floor}
          onClick={() => onChange(floor)}
        >
          {FLOOR_PLANS[floor].label}
          <small>부스 {counts[floor]}개</small>
        </button>
      ))}
    </div>
  );
}
