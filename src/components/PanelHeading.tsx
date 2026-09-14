interface Props {
  title: string;
  accent: string;
  note?: string;
}

/** 각 탭 상단의 큰 제목 + 우측 보조 문구. */
export function PanelHeading({ title, accent, note }: Props) {
  return (
    <>
      <div className="phead">
        <h2>
          {title} <b>{accent}</b>
        </h2>
        {note ? <span className="note">{note}</span> : null}
      </div>
      <div className="zig" />
    </>
  );
}
