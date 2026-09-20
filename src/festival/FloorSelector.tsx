import type { FloorId, FloorPlanDef } from '../../shared/types';
import { FLOOR_IDS, findFloorPlan } from '../../shared/floorPlans';

interface Props {
  active: FloorId;
  onChange: (floor: FloorId) => void;
  /** 서버에서 받은 배치도 (층 이름을 여기서 읽는다). */
  plans?: FloorPlanDef[];
  /** 층별 부스 개수 */
  counts: Record<FloorId, number>;
}

export function FloorSelector({ active, onChange, plans, counts }: Props) {
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
          {findFloorPlan(plans, floor).label}
          <small>부스 {counts[floor]}개</small>
        </button>
      ))}
    </div>
  );
}
