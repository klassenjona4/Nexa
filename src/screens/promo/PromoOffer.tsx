import { formatLongDate } from '../../../shared/dates';
import s from './Redeem.module.css';

// The offer at a glance: 1 month of Premium, free. Shown only to people who arrived with a code
// link, never on public pages.
export function PromoOffer({ compact = false, headingLevel = 'h1', headingId }: { compact?: boolean; headingLevel?: 'h1' | 'h2'; headingId?: string }) {
  const H = headingLevel;
  return (
    <div className={[s.offer, compact ? s.offerCompact : ''].join(' ')}>
      <span className={s.offerLabel}>Your event offer</span>
      <H id={headingId} className={s.offerTitle}>
        1 month of Premium, free
      </H>
      <p className={s.price}>
        <span className={s.priceNow}>0 euro</span>
        <span>
          instead of <span className={s.priceWas}>7.99 euro</span> a month
        </span>
      </p>
      {compact ? (
        <p className={s.offerText}>No card needed. Nothing renews.</p>
      ) : (
        <ul className={s.offerList}>
          <li>Unlimited projects</li>
          <li>Brief breakdowns and statements in every project, within the fair use limit</li>
          <li>No card needed. Nothing renews.</li>
        </ul>
      )}
    </div>
  );
}

// After redeeming: the free month is active, with its exact end date.
export function PromoActive({ premiumUntil, headingLevel = 'h1' }: { premiumUntil: string; headingLevel?: 'h1' | 'h3' }) {
  const H = headingLevel;
  return (
    <div className={[s.offer, headingLevel === 'h3' ? s.offerCompact : ''].join(' ')}>
      <span className={s.offerLabel}>Premium is active</span>
      <H className={s.offerTitle}>Your free month of Premium has started</H>
      <p className={s.price}>
        <span className={s.priceNow}>Free until {formatLongDate(premiumUntil)}</span>
      </p>
    </div>
  );
}
