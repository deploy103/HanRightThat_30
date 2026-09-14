import { useRef } from 'react';
import type { Booth, BoothPosition, FloorId } from '../../shared/types';
import { FLOOR_PLANS } from '../data/floorPlans';
import { BoothPin } from './BoothPin';

interface Props {
  floor: FloorId;
  /** 해당 층의 부스만 넘긴다. */
  booths: Booth[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 관리 화면에서 지도를 눌러 위치를 지정할 때 사용한다. */
  onPlace?: (position: BoothPosition) => void;
}

/** 2층/3층이 같은 구조이므로 층 데이터만 바꿔 재사용하는 공통 배치도. */
export function FloorPlan({ floor, booths, selectedId, onSelect, onPlace }: Props) {
  const plan = FLOOR_PLANS[floor];
  const surfaceRef = useRef<HTMLDivElement>(null);

  const handlePlace = (event: React.MouseEvent<HTMLButtonElement>) => {
    const surface = surfaceRef.current;
    if (!surface || !onPlace) return;
    const rect = surface.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 1000) / 10;
    onPlace({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  };

  return (
    <div className="floorplan-wrap">
      <p className="floorplan-caption">
        <b>{plan.label}</b>
        <span>{plan.hint}</span>
      </p>

      <div className="floorplan" ref={surfaceRef}>
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
          <BoothPin
            key={booth.id}
            booth={booth}
            index={index}
            selected={booth.id === selectedId}
            onSelect={onSelect}
          />
        ))}

        {onPlace ? (
          <button
            type="button"
            className="floorplan-place"
            onClick={handlePlace}
            aria-label={`${plan.label} 배치도를 눌러 부스 위치 지정`}
          />
        ) : null}
      </div>
    </div>
  );
}
