import { EqStrip } from './EqStrip';

interface Props {
  title: string;
  lede: string;
}

export function FestivalHeader({ title, lede }: Props) {
  return (
    <header className="hero">
      <div className="wrap hero-inner">
        <span className="badge">
          <span>{title}</span>
        </span>
        <p className="lede">{lede}</p>
      </div>
      <EqStrip />
    </header>
  );
}
