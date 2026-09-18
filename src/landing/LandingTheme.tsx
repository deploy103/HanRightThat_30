import type { LandingContent } from '../../shared/types';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { LandingSectionHeading } from './LandingSectionHeading';

interface Props {
  content: LandingContent;
}

/** '소리' 주제 소개. 운영자가 승인한 텍스트만 노출하며 자유 HTML은 렌더링하지 않는다. */
export function LandingTheme({ content }: Props) {
  const hasContent = Boolean(content.themeTitle || content.themeBody);
  const { ref, revealed } = useScrollReveal<HTMLElement>();

  return (
    <section
      id="theme"
      ref={ref}
      className={`landing-section landing-reveal${revealed ? ' is-revealed' : ''}`}
    >
      <div className="wrap landing-theme-layout">
        <div className="landing-theme-copy">
          <LandingSectionHeading index="01" eyebrow="축제 소개" title={content.themeTitle || '축제 소개'} />
          {hasContent ? (
            content.themeBody ? <p className="landing-theme-body">{content.themeBody}</p> : null
          ) : (
            <p className="empty">주제 소개 문구를 준비하고 있습니다.</p>
          )}
        </div>
        <div className="landing-theme-mark" aria-hidden="true">
          <span>{content.theme || '소리'}</span>
        </div>
      </div>
    </section>
  );
}
