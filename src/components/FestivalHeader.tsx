import { EqStrip } from './EqStrip';

export interface HeroFact {
  label: string;
  value: string;
}

interface Props {
  eyebrow: string;
  heading: string;
  lede: string;
  facts?: HeroFact[];
}

export function FestivalHeader({ eyebrow, heading, lede, facts }: Props) {
  return (
    <header className="hero">
      <div className="wrap hero-inner">
        <span className="badge">
          <span>{eyebrow}</span>
        </span>
        <h1 className="hero-heading">{heading}</h1>
        <p className="lede">{lede}</p>
        {facts && facts.length > 0 ? (
          <div className="hero-facts">
            {facts.map((fact) => (
              <div className="hero-fact" key={fact.label}>
                <span className="hero-fact-label">{fact.label}</span>
                <span className="hero-fact-value">{fact.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <EqStrip />
    </header>
  );
}
