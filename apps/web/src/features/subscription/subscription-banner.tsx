import {
  addDays,
  daysLeft,
  localDateOf,
  SUBSCRIPTION_GRACE_DAYS,
  SUBSCRIPTION_WARNING_DAYS,
} from '@edildy/contracts';
import { formatLocalDate } from '@edildy/i18n';
import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '@/lib/i18n';
import { useCan, useMe } from '@/lib/session';

const WARN_FROM = Math.max(...SUBSCRIPTION_WARNING_DAYS);

/**
 * The end of the subscription (BR-01.07), above every page: owners and admins (tenant.manage) see it from 14 days before
 * the end date and through the grace period; once read-only, everyone sees why nothing can be changed.
 */
export function SubscriptionBanner({ now = new Date() }: { now?: Date }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { tenant } = useMe();
  const canManage = useCan('tenant.manage');
  const s = tenant.subscription;
  const left = daysLeft(s.endsOn, localDateOf(now, tenant.timezone));
  let text: string | null = null;
  if (s.state === 'expired') text = t('subscription.banner.expired');
  else if (canManage && s.endsOn && s.state === 'grace')
    text = t('subscription.banner.grace', {
      date: formatLocalDate(s.endsOn, locale),
      graceEnd: formatLocalDate(addDays(s.endsOn, SUBSCRIPTION_GRACE_DAYS), locale),
    });
  else if (canManage && s.endsOn && left !== null && left <= WARN_FROM)
    text = t('subscription.banner.ending', { date: formatLocalDate(s.endsOn, locale), days: left });
  if (!text) return null;
  const urgent = s.state !== 'active';
  return (
    <div
      role="status"
      className={`flex items-center gap-2 border-b px-4 py-2 text-sm lg:px-6 ${urgent ? 'bg-status-bad-soft text-status-bad-text' : 'bg-status-late-soft text-status-late-text'}`}
    >
      <CalendarClock className="size-4 shrink-0" aria-hidden />
      <span>{text}</span>
      <a href="mailto:hello@edildy.com" className="ml-auto shrink-0 font-medium underline">
        {t('subscription.banner.contact')}
      </a>
    </div>
  );
}
