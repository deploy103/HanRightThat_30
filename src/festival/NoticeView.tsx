import { useState } from 'react';
import type { Announcement } from '../../shared/types';
import { PanelHeading } from '../components/PanelHeading';
import { formatNoticeDate } from '../lib/datetime';

interface Props {
  /** 게시된 공지만 넘어온다 (필터링은 공개 API 에서 이미 끝나 있다). */
  announcements: Announcement[];
}

/** 최근 3일 안에 수정된 공지에는 표시등을 붙인다. */
const RECENT_WINDOW_MS = 1000 * 60 * 60 * 24 * 3;

/**
 * 공지 탭 — 목록 → 클릭 → 본문 펼치기.
 *
 * 본문은 순수 텍스트로만 저장/렌더한다. HTML 을 해석하지 않으므로(React 가 기본 이스케이프)
 * 관리자가 입력한 값으로 스크립트가 실행될 여지가 없다. 줄바꿈만 CSS(white-space)로 살린다.
 */
export function NoticeView({ announcements }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const ordered = [...announcements].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const now = Date.now();

  return (
    <>
      <PanelHeading
        title="공지"
        accent="사항"
        note={ordered.length > 0 ? `전체 ${ordered.length}건` : undefined}
      />

      {ordered.length === 0 ? (
        <p className="empty">등록된 공지가 없습니다.</p>
      ) : (
        <ul className="notice-list">
          {ordered.map((item) => {
            const open = openId === item.id;
            const isRecent = now - new Date(item.updatedAt).getTime() < RECENT_WINDOW_MS;
            return (
              <li key={item.id} className={`notice-item${open ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="notice-summary"
                  aria-expanded={open}
                  aria-controls={`notice-body-${item.id}`}
                  onClick={() => setOpenId(open ? null : item.id)}
                >
                  <span className="notice-title">
                    {isRecent ? <span className="led" aria-hidden="true" /> : null}
                    {item.title}
                  </span>
                  <span className="notice-date">{formatNoticeDate(item.createdAt)}</span>
                  <span className="notice-caret" aria-hidden="true">
                    {open ? '−' : '+'}
                  </span>
                </button>

                <div className="notice-body" id={`notice-body-${item.id}`} hidden={!open}>
                  <p className="notice-text">{item.body}</p>
                  {item.updatedAt !== item.createdAt ? (
                    <p className="notice-updated">{formatNoticeDate(item.updatedAt)} 수정</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
