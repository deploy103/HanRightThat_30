import { useState } from 'react';
import type { Show } from '../../shared/types';

export type ShowDraftInput = Omit<Show, 'id' | 'order'>;

interface Props {
  initial: Show | null;
  busy: boolean;
  onSubmit: (input: ShowDraftInput) => void;
  onCancel: () => void;
}

export function ShowEditor({ initial, busy, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState({
    time: initial?.time ?? '13:00',
    team: initial?.team ?? '',
    title: initial?.title ?? '',
    genre: initial?.genre ?? '',
    note: initial?.note ?? '',
  });

  const patch = (values: Partial<typeof draft>) =>
    setDraft((current) => ({ ...current, ...values }));

  return (
    <form
      className="admin-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          time: draft.time.trim(),
          team: draft.team.trim(),
          title: draft.title.trim(),
          genre: draft.genre.trim() || undefined,
          note: draft.note.trim() || undefined,
        });
      }}
    >
      <h3>{initial ? `${initial.title} 수정` : '공연 추가'}</h3>

      <div className="admin-fields admin-fields-inline">
        <label>
          시간 (HH:MM)
          <input
            value={draft.time}
            onChange={(event) => patch({ time: event.target.value })}
            placeholder="13:00"
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
          공연명
          <input
            value={draft.title}
            onChange={(event) => patch({ title: event.target.value })}
            maxLength={60}
            required
          />
        </label>
        <label>
          장르 (선택)
          <input
            value={draft.genre}
            onChange={(event) => patch({ genre: event.target.value })}
            maxLength={20}
          />
        </label>
        <label>
          비고 (선택)
          <input
            value={draft.note}
            onChange={(event) => patch({ note: event.target.value })}
            maxLength={60}
          />
        </label>
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
