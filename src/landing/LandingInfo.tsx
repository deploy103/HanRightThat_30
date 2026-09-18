import type { LandingContent } from '../../shared/types';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { LandingSectionHeading } from './LandingSectionHeading';

interface Props {
  content: LandingContent;
}

export function LandingInfo({ content }: Props) {
  const { ref, revealed } = useScrollReveal<HTMLElement>();

  const rows: { label: string; value: string }[] = [
    { label: '참여 대상', value: content.audienceInfo },
    { label: '입장 안내', value: content.admissionInfo },
    { label: '결제 안내', value: content.paymentInfo },
    { label: '운영 시간', value: content.operatingHoursInfo },
    { label: '문의', value: content.contactInfo },
  ].filter((row) => row.value.trim() !== '');

  const hasVenue = Boolean(content.venueName || content.address || content.directionsUrl);

  return (
    <section
      id="info"
      ref={ref}
      className={`landing-section landing-reveal${revealed ? ' is-revealed' : ''}`}
    >
      <div className="wrap">
        <LandingSectionHeading index="05" eyebrow="이용 안내" title="이용 안내" />

        {hasVenue ? (
          <div className="landing-info-venue">
            {content.venueName ? <p className="landing-info-venue-name">{content.venueName}</p> : null}
            {content.address ? <p className="landing-info-venue-address">{content.address}</p> : null}
            {content.directionsUrl ? (
              <a className="landing-info-directions" href={content.directionsUrl} target="_blank" rel="noreferrer">
                지도 앱에서 열기 ↗
              </a>
            ) : null}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <p className="empty">이용 안내를 준비하고 있습니다.</p>
        ) : (
          <dl className="landing-info-grid">
            {rows.map((row) => (
              <div key={row.label} className="landing-info-row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {content.faqItems.length > 0 ? (
          <div className="landing-faq">
            <h3 className="landing-faq-title">자주 묻는 질문</h3>
            {content.faqItems.map((item) => (
              <details key={item.id} className="landing-faq-item">
                <summary>
                  <span className="landing-faq-icon" aria-hidden="true" />
                  <span>{item.question}</span>
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
