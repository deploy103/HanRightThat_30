interface Props {
  onAdmin: () => void;
}

export function FestivalFooter({ onAdmin }: Props) {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer-inner">
        <span>제30회 한빛제 · 학생회</span>
        <button type="button" className="linklike" onClick={onAdmin}>
          운영자 관리
        </button>
      </div>
    </footer>
  );
}
