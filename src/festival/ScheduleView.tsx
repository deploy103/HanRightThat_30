import type { FestivalMeta, Show } from '../../shared/types';
import { PanelHeading } from '../components/PanelHeading';
import { padRank } from '../lib/format';

interface Props {
  shows: Show[];
  meta: FestivalMeta;
}

/** 공연 순서 — 큰 카드 대신 정보 밀도가 높은 표로 구성한다. */
export function ScheduleView({ shows, meta }: Props) {
  const ordered = [...shows].sort((a, b) => a.order - b.order);

  return (
    <>
      <PanelHeading title="공연" accent="순서" note={meta.stage} />

      {ordered.length === 0 ? (
        <p className="empty">등록된 공연이 없습니다. 관리 화면에서 공연을 추가해 주세요.</p>
      ) : (
        <>
          <p className="table-hint">표를 옆으로 밀면 장르 · 비고까지 볼 수 있습니다</p>
          <div className="table-scroll">
            <table className="schedule-table">
              <caption className="sr-only">
                {meta.stage} 공연 순서 — 순서, 시간, 팀/학급, 공연명, 장르/비고
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="col-order">
                    순서
                  </th>
                  <th scope="col" className="col-time">
                    시간
                  </th>
                  <th scope="col" className="col-team">
                    팀 / 학급
                  </th>
                  <th scope="col" className="col-title">
                    공연명
                  </th>
                  <th scope="col" className="col-genre">
                    장르 / 비고
                  </th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((show) => (
                  <tr key={show.id}>
                    <td className="col-order">{padRank(show.order)}</td>
                    <td className="col-time">{show.time}</td>
                    <td className="col-team">{show.team}</td>
                    <td className="col-title">{show.title}</td>
                    <td className="col-genre">
                      {show.genre ? <span className="genre-tag">{show.genre}</span> : null}
                      {show.note ? <span className="genre-note">{show.note}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
