import type { ReactNode } from 'react';

interface Props {
  index: string;
  eyebrow: string;
  title: string;
  action?: ReactNode;
}

/** 소개 페이지 섹션마다 반복하는 번호(고스트 넘버)+상단 라벨+제목 조합. 목차처럼 읽히게 만든다. */
export function LandingSectionHeading({ index, eyebrow, title, action }: Props) {
  return (
    <div className="landing-section-head">
      <span className="landing-section-index" aria-hidden="true">
        {index}
      </span>
      <div className="landing-section-headrow">
        <div>
          <p className="section-eyebrow">{eyebrow}</p>
          <h2 className="landing-section-title">{title}</h2>
        </div>
        {action}
      </div>
    </div>
  );
}
