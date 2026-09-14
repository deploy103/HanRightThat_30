import { useState } from 'react';
import type { Booth, BoothInput, FloorId } from '../../shared/types';
import { FLOOR_IDS, FLOOR_PLANS } from '../data/floorPlans';
import { FloorPlan } from '../festival/FloorPlan';

interface Props {
  initial: Booth | null;
  busy: boolean;
  onSubmit: (input: BoothInput) => void;
  onCancel: () => void;
}

interface Draft {
  name: string;
  team: string;
  floor: FloorId;
  amount: string;
  place: string;
  x: string;
  y: string;
}

function toDraft(booth: Booth | null): Draft {
  return {
    name: booth?.name ?? '',
    team: booth?.team ?? '',
    floor: booth?.floor ?? 2,
    amount: String(booth?.amount ?? 0),
    place: booth?.place ?? '',
    x: String(booth?.position.x ?? 50),
    y: String(booth?.position.y ?? 50),
  };
}

/** 부스 추가/수정 폼. 위치는 숫자 입력 또는 배치도 클릭으로 지정한다. */
export function BoothEditor({ initial, busy, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));

  const patch = (values: Partial<Draft>) => setDraft((current) => ({ ...current, ...values }));

  const previewBooth: Booth = {
    id: initial?.id ?? 'draft',
    name: draft.name || '새 부스',
    team: draft.team,
    floor: draft.floor,
    amount: Number(draft.amount) || 0,
    position: { x: Number(draft.x) || 0, y: Number(draft.y) || 0 },
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({
      name: draft.name.trim(),
      team: draft.team.trim(),
      floor: draft.floor,
      amount: Number(draft.amount.replace(/[,\s]/g, '')) || 0,
      place: draft.place.trim() || undefined,
      position: { x: Number(draft.x) || 0, y: Number(draft.y) || 0 },
    });
  };

  return (
    <form className="admin-editor" onSubmit={handleSubmit}>
      <h3>{initial ? `${initial.name} 수정` : '부스 추가'}</h3>

      <div className="admin-editor-body">
        <div className="admin-fields">
          <label>
            부스명
            <input
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
              maxLength={40}
              required
            />
          </label>
          <label>
            팀 / 학급
            <input
              value={draft.team}
              onChange={(event) => patch({ team: event.target.value })}
              maxLength={40}
              required
            />
          </label>
          <label>
            층
            <select
              value={draft.floor}
              onChange={(event) => patch({ floor: Number(event.target.value) as FloorId })}
            >
              {FLOOR_IDS.map((floor) => (
                <option key={floor} value={floor}>
                  {FLOOR_PLANS[floor].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            모금액 (원)
            <input
              type="number"
              min={0}
              step={1}
              value={draft.amount}
              onChange={(event) => patch({ amount: event.target.value })}
              required
            />
          </label>
          <label>
            위치 설명 (선택)
            <input
              value={draft.place}
              onChange={(event) => patch({ place: event.target.value })}
              maxLength={40}
              placeholder="예: 2층 클라우드보안과 1-1"
            />
          </label>
          {/* 배치도 클릭으로 들어오는 소수 좌표가 step 검증에 걸리지 않도록 step="any" 를 쓴다. */}
          <div className="admin-field-row">
            <label>
              위치 X (%)
              <input
                type="number"
                min={0}
                max={100}
                step="any"
                value={draft.x}
                onChange={(event) => patch({ x: event.target.value })}
              />
            </label>
            <label>
              위치 Y (%)
              <input
                type="number"
                min={0}
                max={100}
                step="any"
                value={draft.y}
                onChange={(event) => patch({ y: event.target.value })}
              />
            </label>
          </div>
        </div>

        <div className="admin-preview">
          <p className="admin-preview-hint">배치도를 클릭해 위치를 지정할 수 있습니다.</p>
          <FloorPlan
            floor={draft.floor}
            booths={[previewBooth]}
            selectedId={previewBooth.id}
            onSelect={() => undefined}
            onPlace={(position) => patch({ x: String(position.x), y: String(position.y) })}
          />
        </div>
      </div>

      <div className="admin-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          저장
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          취소
        </button>
      </div>
    </form>
  );
}
