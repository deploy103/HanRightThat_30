import { useState } from 'react';
import type { FestivalMeta } from '../../shared/types';

interface Props {
  meta: FestivalMeta;
  busy: boolean;
  onSave: (meta: FestivalMeta) => Promise<void>;
}

export function AdminMeta({ meta, busy, onSave }: Props) {
  const [draft, setDraft] = useState({
    updated: meta.updated,
    goal: String(meta.goal),
    stage: meta.stage,
  });

  return (
    <section className="admin-section">
      <header className="admin-section-head">
        <h2>기본 정보</h2>
      </header>
      <form
        className="admin-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({
            updated: draft.updated.trim(),
            goal: Number(draft.goal) || 0,
            stage: draft.stage.trim(),
          });
        }}
      >
        <div className="admin-fields admin-fields-inline">
          <label>
            갱신 시각 문구
            <input
              value={draft.updated}
              onChange={(event) => setDraft({ ...draft, updated: event.target.value })}
              placeholder="9월 8일 오후 3시 기준"
              maxLength={40}
            />
          </label>
          <label>
            목표 금액 (0이면 미표시)
            <input
              type="number"
              min={0}
              step={1}
              value={draft.goal}
              onChange={(event) => setDraft({ ...draft, goal: event.target.value })}
            />
          </label>
          <label>
            공연 장소
            <input
              value={draft.stage}
              onChange={(event) => setDraft({ ...draft, stage: event.target.value })}
              maxLength={30}
            />
          </label>
        </div>
        <div className="admin-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            저장
          </button>
        </div>
      </form>
    </section>
  );
}
