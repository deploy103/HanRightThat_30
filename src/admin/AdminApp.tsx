import { useEffect, useState } from 'react';
import type { Booth, BoothInput, FestivalMeta, Show } from '../../shared/types';
import { useFestival } from '../hooks/useFestival';
import { api, getAdminKey, setAdminKey } from '../lib/api';
import { AdminBooths } from './AdminBooths';
import { AdminMeta } from './AdminMeta';
import { AdminShows } from './AdminShows';
import type { ShowDraftInput } from './ShowEditor';

interface Props {
  navigate: (to: string) => void;
}

export function AdminApp({ navigate }: Props) {
  const { data, loading, error, refresh } = useFestival();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [needKey, setNeedKey] = useState(false);
  const [keyInput, setKeyInput] = useState(() => getAdminKey());

  useEffect(() => {
    api
      .getAdminStatus()
      .then((status) => setNeedKey(status.protected))
      .catch(() => setNeedKey(false));
  }, []);

  /** 모든 변경 작업은 저장 -> 재조회 순서로 처리해 화면과 파일 내용을 일치시킨다. */
  const run = async (task: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      await refresh();
      setMessage(done);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handlers = {
    createBooth: (input: BoothInput) => run(() => api.createBooth(input), '부스를 추가했습니다.'),
    updateBooth: (id: string, input: BoothInput) =>
      run(() => api.updateBooth(id, input), '부스를 수정했습니다.'),
    deleteBooth: async (booth: Booth) => {
      if (!window.confirm(`'${booth.name}' 부스를 삭제할까요?`)) return;
      await run(() => api.deleteBooth(booth.id), '부스를 삭제했습니다.');
    },
    quickAmount: (booth: Booth, amount: number) =>
      run(
        () =>
          api.updateBooth(booth.id, {
            name: booth.name,
            team: booth.team,
            floor: booth.floor,
            amount,
            place: booth.place,
            position: booth.position,
          }),
        `${booth.name} 모금액을 저장했습니다.`,
      ),
    createShow: (input: ShowDraftInput) => run(() => api.createShow(input), '공연을 추가했습니다.'),
    updateShow: (id: string, input: ShowDraftInput) =>
      run(() => api.updateShow(id, input), '공연을 수정했습니다.'),
    deleteShow: async (show: Show) => {
      if (!window.confirm(`'${show.title}' 공연을 삭제할까요?`)) return;
      await run(() => api.deleteShow(show.id), '공연을 삭제했습니다.');
    },
    reorderShows: (ids: string[]) => run(() => api.reorderShows(ids), '공연 순서를 변경했습니다.'),
    saveMeta: (meta: FestivalMeta) => run(() => api.updateMeta(meta), '기본 정보를 저장했습니다.'),
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="wrap admin-header-inner">
          <div>
            <span className="badge badge-small">
              <span>제30회 한빛제</span>
            </span>
            <h1>운영자 관리</h1>
          </div>
          <button type="button" className="btn" onClick={() => navigate('/')}>
            공개 화면 보기
          </button>
        </div>
      </header>

      <main className="wrap admin-main">
        {needKey ? (
          <form
            className="admin-key"
            onSubmit={(event) => {
              event.preventDefault();
              setAdminKey(keyInput.trim());
              void refresh();
              setMessage('관리자 키를 저장했습니다.');
            }}
          >
            <label>
              관리자 키
              <input
                type="password"
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button type="submit" className="btn">
              적용
            </button>
          </form>
        ) : null}

        {message ? (
          <p className="admin-message" role="status">
            {message}
          </p>
        ) : null}
        {error ? <p className="admin-message admin-message-error">{error}</p> : null}
        {loading ? <p className="admin-message">불러오는 중…</p> : null}

        {data ? (
          <>
            <AdminBooths
              booths={data.booths}
              busy={busy}
              onCreate={handlers.createBooth}
              onUpdate={handlers.updateBooth}
              onDelete={handlers.deleteBooth}
              onQuickAmount={handlers.quickAmount}
            />
            <AdminShows
              shows={data.shows}
              busy={busy}
              onCreate={handlers.createShow}
              onUpdate={handlers.updateShow}
              onDelete={handlers.deleteShow}
              onReorder={handlers.reorderShows}
            />
            <AdminMeta key={data.meta.updated} meta={data.meta} busy={busy} onSave={handlers.saveMeta} />
          </>
        ) : null}
      </main>
    </div>
  );
}
