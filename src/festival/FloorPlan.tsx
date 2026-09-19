import { FLOOR_PLANS } from '../../shared/floorPlans';
import type { Booth, FloorId } from '../../shared/types';
import { BoothArea } from './BoothArea';

interface Props {
  floor: FloorId;
  /** 해당 층의 부스만 넘긴다. */
  booths: Booth[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * 공개 화면의 층 배치도 — 읽기 전용 렌더러.
 *
 * 레이아웃(교실/복도/계단)은 shared/floorPlans 하나에서만 오고,
 * 부스 영역은 Booth.position(중심 %) + Booth.size(크기 %) 로 그린다.
 * 편집(생성/이동/크기 변경)은 관리자 저장소의 편집기가 담당하며, 여기에는 어떤 mutation 도 없다.
 */
export function FloorPlan({ floor, booths, selectedId, onSelect }: Props) {
  const plan = FLOOR_PLANS[floor];

  return (
    <div className="floorplan-wrap">
      <p className="floorplan-caption">
        <b>{plan.label}</b>
        <span>{plan.hint}</span>
      </p>

      <div className="floorplan">
        <div className="floorplan-grid" aria-hidden="true" />

        {plan.rooms.map((room) => (
          <div
            key={room.id}
            className={`room room-${room.tone}`}
            style={{
              left: `${room.x}%`,
              top: `${room.y}%`,
              width: `${room.w}%`,
              height: `${room.h}%`,
            }}
          >
            <span className="room-label">{room.label}</span>
          </div>
        ))}

        {booths.map((booth, index) => (
          <BoothArea
            key={booth.id}
            booth={booth}
            index={index}
            selected={booth.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
