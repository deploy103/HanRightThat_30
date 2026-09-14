import { useState } from 'react';
import type { Booth, BoothInput } from '../../shared/types';
import { FLOOR_PLANS } from '../data/floorPlans';
import { formatWon } from '../lib/format';
import { BoothEditor } from './BoothEditor';

interface Props {
  booths: Booth[];
  busy: boolean;
  onCreate: (input: BoothInput) => Promise<void>;
  onUpdate: (id: string, input: BoothInput) => Promise<void>;
  onDelete: (booth: Booth) => Promise<void>;
  onQuickAmount: (booth: Booth, amount: number) => Promise<void>;
}

type EditTarget = { mode: 'new' } | { mode: 'edit'; booth: Booth } | null;

export function AdminBooths({ booths, busy, onCreate, onUpdate, onDelete, onQuickAmount }: Props) {
  const [target, setTarget] = useState<EditTarget>(null);
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});

  const submit = async (input: BoothInput) => {
    if (!target) return;
    if (target.mode === 'new') await onCreate(input);
    else await onUpdate(target.booth.id, input);
    setTarget(null);
  };

  const amountValue = (booth: Booth) => amountDrafts[booth.id] ?? String(booth.amount);

  const saveAmount = async (booth: Booth) => {
    const amount = Number(amountValue(booth).replace(/[,\s]/g, ''));
    if (!Number.isFinite(amount) || amount < 0) return;
    await onQuickAmount(booth, amount);
    setAmountDrafts((current) => {
      const next = { ...current };
      delete next[booth.id];
      return next;
    });
  };

  return (
    <section className="admin-section">
      <header className="admin-section-head">
        <h2>부스 관리</h2>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setTarget({ mode: 'new' })}
          disabled={busy}
        >
          부스 추가
        </button>
      </header>

      {target ? (
        <BoothEditor
          key={target.mode === 'edit' ? target.booth.id : 'new'}
          initial={target.mode === 'edit' ? target.booth : null}
          busy={busy}
          onSubmit={(input) => void submit(input)}
          onCancel={() => setTarget(null)}
        />
      ) : null}

      <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">부스명</th>
              <th scope="col">팀 / 학급</th>
              <th scope="col">층</th>
              <th scope="col">위치 (X, Y)</th>
              <th scope="col">모금액 수기 입력</th>
              <th scope="col">관리</th>
            </tr>
          </thead>
          <tbody>
            {booths.map((booth) => (
              <tr key={booth.id}>
                <td>
                  <strong>{booth.name}</strong>
                  {booth.place ? <em className="admin-sub">{booth.place}</em> : null}
                </td>
                <td>{booth.team}</td>
                <td>{FLOOR_PLANS[booth.floor].label}</td>
                <td className="admin-mono">
                  {booth.position.x}, {booth.position.y}
                </td>
                <td>
                  <div className="admin-amount">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      aria-label={`${booth.name} 모금액`}
                      value={amountValue(booth)}
                      onChange={(event) =>
                        setAmountDrafts((current) => ({
                          ...current,
                          [booth.id]: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => void saveAmount(booth)}
                      disabled={busy || amountValue(booth) === String(booth.amount)}
                    >
                      저장
                    </button>
                  </div>
                  <span className="admin-sub">현재 {formatWon(booth.amount)}원</span>
                </td>
                <td>
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => setTarget({ mode: 'edit', booth })}
                      disabled={busy}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => void onDelete(booth)}
                      disabled={busy}
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {booths.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-empty">
                  등록된 부스가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
