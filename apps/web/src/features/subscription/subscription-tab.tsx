import { FEATURES, type SubscriptionState, type TenantSubscriptionDto } from '@edildy/contracts';
import { formatLocalDate } from '@edildy/i18n';
import { useQuery } from '@tanstack/react-query';
import { Check, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorState, LoadingState } from '@/components/states';
import { errorText } from '@/lib/errors';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocale } from '@/lib/i18n';
import { api } from '@/lib/session';

export const STATE_BADGE: Record<SubscriptionState, 'default' | 'warning' | 'destructive'> = {
  active: 'default',
  grace: 'warning',
  expired: 'destructive',
};

/** Settings → Abunəlik (BR-01): the plan, the end date, the limits against what is used, and the feature areas. */
export function SubscriptionTab() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['tenant', 'subscription'], queryFn: api.tenant.subscription });
  if (q.isPending) return <LoadingState />;
  if (q.isError) return <ErrorState message={errorText(t, q.error)} onRetry={() => void q.refetch()} />;
  return <SubscriptionView s={q.data} />;
}

export function SubscriptionView({ s }: { s: TenantSubscriptionDto }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const date = (d: string) => formatLocalDate(d, locale);
  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
  const limit = (label: string, used: number, max: number | null) => {
    const full = max !== null && used >= max;
    return (
      <div className="flex justify-between gap-4 py-1.5 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={full ? 'text-status-bad-text font-medium' : 'font-medium'}>
          {max === null
            ? t('subscription.usedUnlimited', { used })
            : t('subscription.used', { used, limit: max })}
        </span>
      </div>
    );
  };
  return (
    <div className="grid items-start gap-6 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>
            {t('subscription.plan')}: {t(`subscription.plans.${s.plan}`)}
          </CardTitle>
          <Badge variant={STATE_BADGE[s.state]}>{t(`subscription.states.${s.state}`)}</Badge>
        </CardHeader>
        <CardContent className="divide-y">
          {row(t('subscription.period'), t(`subscription.periods.${s.period}`))}
          {row(t('subscription.startsOn'), date(s.startsOn))}
          {row(t('subscription.endsOn'), s.endsOn ? date(s.endsOn) : t('subscription.noEnd'))}
          <div className="pt-3">
            <p className="mb-1 text-sm font-medium">{t('subscription.usage')}</p>
            {limit(t('subscription.staff'), s.usage.staff, s.limits.staff)}
            {limit(t('subscription.workers'), s.usage.workers, s.limits.workers)}
            {limit(t('subscription.branches'), s.usage.branches, s.limits.branches)}
            <p className="text-muted-foreground pt-1 text-xs">{t('subscription.branchesHint')}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('subscription.included')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-muted-foreground text-sm">{t('subscription.core')}</p>
          <ul className="grid gap-1.5" aria-label={t('subscription.included')}>
            {FEATURES.map((f) => {
              const on = s.features.includes(f);
              return (
                <li
                  key={f}
                  className={`flex items-center gap-2 text-sm ${on ? '' : 'text-muted-foreground'}`}
                >
                  {on ? (
                    <Check className="text-status-ok-text size-4" aria-hidden />
                  ) : (
                    <Minus className="size-4" aria-hidden />
                  )}
                  <span>{t(`subscription.features.${f}`)}</span>
                  {!on && <span className="sr-only">({t('subscription.notIncluded')})</span>}
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground text-sm">{t('subscription.contact')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
