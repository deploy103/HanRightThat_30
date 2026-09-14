import { useState } from 'react';
import type { Show } from '../../shared/types';
import { padRank } from '../lib/format';
import { ShowEditor, type ShowDraftInput } from './ShowEditor';

interface Props {
  shows: Show[];
  busy: boolean;
  onCreate: (input: ShowDraftInput) => Promise<void>;
  onUpdate: (id: string, input: ShowDraftInput) => Promise<void>;
  onDelete: (show: Show) => Promise<void>;
  onReorder: (ids: string[]) => Promise<void>;
}

type EditTarget = { mode: 'new' } | { mode: 'edit'; show: Show } | null;

export function AdminShows({ shows, busy, onCreate, onUpdate, onDelete, onReorder }: Props) {
  const [target, setTarget] = useState<EditTarget>(null);
  const ordered = [...shows].sort((a, b) => a.order - b.order);

  const move = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= ordered.length) return;
    const ids = ordered.map((show) => show.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    void onReorder(ids);
  };

  const submit = async (input: ShowDraftInput) => {
    if (!target) return;
    if (target.mode === 'new') await onCreate(input);
    else await onUpdate(target.show.id, input);
    setTarget(null);
  };

  return (
    <section className="admin-section">
      <header className="admin-section-head">
        <h2>공연 관리</h2>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setTarget({ mode: 'new' })}
          disabled={busy}
        >
          공연 추가
        </button>
      </header>

      {target ? (
        <ShowEditor
          key={target.mode === 'edit' ? target.show.id : 'new'}
          initial={target.mode === 'edit' ? target.show : null}
          busy={busy}
          onSubmit={(input) => void submit(input)}
          onCancel={() => setTarget(null)}
        />
      ) : null}

      <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">순서</th>
              <th scope="col">시간</th>
              <th scope="col">팀 / 학급</th>
              <th scope="col">공연명</th>
              <th scope="col">장르 / 비고</th>
              <th scope="col">관리</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((show, index) => (
              <tr key={show.id}>
                <td className="admin-mono">{padRank(show.order)}</td>
                <td className="admin-mono">{show.time}</td>
                <td>{show.team}</td>
                <td>{show.title}</td>
                <td>
                  {show.genre ?? '-'}
                  {show.note ? <em className="admin-sub">{show.note}</em> : null}
                </td>
                <td>
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => move(index, -1)}
                      disabled={busy || index === 0}
                      aria-label={`${show.title} 순서 올리기`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => move(index, 1)}
                      disabled={busy || index === ordered.length - 1}
                      aria-label={`${show.title} 순서 내리기`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => setTarget({ mode: 'edit', show })}
                      disabled={busy}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => void onDelete(show)}
                      disabled={busy}
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {ordered.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-empty">
                  등록된 공연이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
