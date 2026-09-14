import type { Booth } from '../../shared/types';

interface Props {
  booth: Booth;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function BoothPin({ booth, index, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      className={`booth-pin${selected ? ' is-selected' : ''}`}
      style={{ left: `${booth.position.x}%`, top: `${booth.position.y}%` }}
      aria-pressed={selected}
      onClick={() => onSelect(booth.id)}
    >
      <span className="booth-pin-marker">{index + 1}</span>
      <span className="booth-pin-label">{booth.name}</span>
    </button>
  );
}
