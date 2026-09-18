import type { LandingContent } from '../../shared/types';

interface Props {
  content: LandingContent;
}

/** /play 화면의 FestivalFooter와는 별개다 — 근거 없는 후원사/후기는 추가하지 않는다. */
export function LandingFooter({ content }: Props) {
  return (
    <footer className="site-footer landing-footer">
      <div className="wrap site-footer-inner landing-footer-inner">
        <span>{content.festivalName}</span>
        {content.organizerText ? <span>주최 · {content.organizerText}</span> : null}
        {content.contactInfo ? <span>{content.contactInfo}</span> : null}
        {content.creditsText ? <span className="landing-footer-credits">{content.creditsText}</span> : null}
      </div>
    </footer>
  );
}
