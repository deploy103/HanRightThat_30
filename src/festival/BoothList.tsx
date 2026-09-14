import type { Booth, FloorId } from '../../shared/types';
import { FLOOR_IDS, FLOOR_PLANS } from '../data/floorPlans';
import { formatWon } from '../lib/format';

interface Props {
  booths: Booth[];
  selectedId: string | null;
  onSelect: (booth: Booth) => void;
}

/** 전체 부스를 층별로 묶어 보여준다. 클릭하면 해당 층 지도로 이동한다. */
export function BoothList({ booths, selectedId, onSelect }: Props) {
  return (
    <aside className="booth-list">
      <h3>부스 목록</h3>
      <p className="booth-list-hint">전체 {booths.length}개 · 누르면 지도에서 위치를 표시합니다</p>

      {FLOOR_IDS.map((floor: FloorId) => {
        const floorBooths = booths.filter((booth) => booth.floor === floor);
        if (floorBooths.length === 0) return null;
        return (
          <section key={floor} className="booth-list-group">
            <h4>{FLOOR_PLANS[floor].label}</h4>
            <ul>
              {floorBooths.map((booth, index) => (
                <li key={booth.id}>
                  <button
                    type="button"
                    aria-pressed={booth.id === selectedId}
                    onClick={() => onSelect(booth)}
                  >
                    <span className="booth-list-index">{index + 1}</span>
                    <span className="booth-list-name">
                      {booth.name}
                      <em>{booth.team}</em>
                    </span>
                    <span className="booth-list-amount">{formatWon(booth.amount)}원</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </aside>
  );
}
