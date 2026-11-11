import { FEATURES, PLAN_CATALOGUE, type PlatformTenantDetail, type TenantActivity } from '@edildy/contracts';
import { formatDateTime, formatLocalDate, formatShortDate } from '@edildy/i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/confirm-button';
import { ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { STATE_BADGE } from '@/features/subscription/subscription-tab';
import { errorText } from '@/lib/errors';
import { useLocale } from '@/lib/i18n';
import { platformApi } from './platform-session';
import { TenantSubscriptionDialog } from './tenant-subscription-dialog';

const COLOR = { actions: 'var(--tp-saffron)', runs: 'var(--tp-primary)', grid: 'var(--tp-line)', axis: 'var(--tp-ink2)' } as const;
const TOOLTIP = { background: 'var(--tp-surface-raised)', border: '1px solid var(--tp-line)', borderRadius: 10, color: 'var(--tp-ink)' };

/** The platform admin's page of one organisation: general data, its plan and set-up, and how much it is used. */
export function PlatformTenantPage({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ['platform', 'tenant', tenantId], queryFn: () => platformApi.tenants.get(tenantId) });
  const activity = useQuery({ queryKey: ['platform', 'tenant', tenantId, 'activity'], queryFn: () => platformApi.tenants.activity(tenantId) });
  const [editing, setEditing] = useState(false);
  if (detail.isPending) return <LoadingState />;
  if (detail.isError) return <ErrorState message={errorText(t, detail.error)} onRetry={() => void detail.refetch()} />;
  const d = detail.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ['platform'] });
  const setStatus = async (suspend: boolean) => {
    try {
      await (suspend ? platformApi.tenants.suspend(d.id) : platformApi.tenants.reactivate(d.id));
      await refresh();
    } catch (e) {
      toast.error(errorText(t, e));
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid gap-0.5">
          <h1 className="text-2xl font-semibold">{d.name}</h1>
          <p className="text-muted-foreground text-sm tabular-nums">{d.orgCode}</p>
        </div>
        <Badge variant={d.status === 'active' ? 'default' : 'destructive'}>{t(`platform.tenants.${d.status}`)}</Badge>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={() => setEditing(true)}>{t('platform.org.changePlan')}</Button>
          <Link to={`/platform/tenants/${d.id}/checklists` as '/platform/tenants'} className={buttonVariants({ variant: 'outline' })}>
            {t('platform.tenants.checklists')}
          </Link>
          {d.status === 'active' ? (
            <ConfirmButton
              variant="destructive"
              label={t('platform.tenants.suspend')}
              title={t('platform.tenants.suspend')}
              description={t('platform.tenants.confirmSuspend', { name: d.name })}
              onConfirm={() => setStatus(true)}
            />
          ) : (
            <Button variant="outline" onClick={() => void setStatus(false)}>
              {t('platform.tenants.reactivate')}
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <General d={d} />
        <Plan d={d} />
        <Setup d={d} />
      </div>
      {activity.isPending && <LoadingState />}
      {activity.isError && <ErrorState message={errorText(t, activity.error)} onRetry={() => void activity.refetch()} />}
      {activity.data && <Activity a={activity.data} timezone={d.timezone} />}
      {editing && (
        <TenantSubscriptionDialog
          tenantId={d.id}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast.success(t('platform.subscription.saved'));
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function General({ d }: { d: PlatformTenantDetail }) {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('platform.org.general')}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <Row label={t('platform.org.timezone')}>{d.timezone}</Row>
        <Row label={t('platform.org.language')}>{d.locale.toUpperCase()}</Row>
        <Row label={t('platform.org.created')}>{formatDateTime(d.createdAt, { locale, timeZone: d.timezone })}</Row>
        <Row label={t('platform.tenants.users')}>{d.userCount}</Row>
        <div className="grid gap-1 py-1.5 text-sm">
          <span className="text-muted-foreground">{t('platform.org.owners')}</span>
          {d.owners.length === 0 && <span>—</span>}
          {d.owners.map((o) => (
            <span key={o.id}>
              <span className="font-medium">{o.fullName}</span> · {o.email ?? '—'}
              {o.status !== 'active' && <span className="text-muted-foreground"> ({o.status === 'invited' ? t('platform.subscription.ownerInvited') : t('platform.tenants.suspended')})</span>}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Plan({ d }: { d: PlatformTenantDetail }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const s = d.subscription;
  const def = PLAN_CATALOGUE[s.plan];
  const limit = (used: number, max: number | null) => (max === null ? t('subscription.usedUnlimited', { used }) : t('subscription.used', { used, limit: max }));
  const extras = FEATURES.filter((f) => s.extraFeatures.includes(f));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>
          {t('subscription.plan')}: {t(`subscription.plans.${s.plan}`)}
        </CardTitle>
        <Badge variant={STATE_BADGE[d.subscriptionState]}>{t(`subscription.states.${d.subscriptionState}`)}</Badge>
      </CardHeader>
      <CardContent className="divide-y">
        <Row label={t('subscription.period')}>{t(`subscription.periods.${s.period}`)}</Row>
        <Row label={t('subscription.startsOn')}>{formatLocalDate(s.startsOn, locale)}</Row>
        <Row label={t('subscription.endsOn')}>{s.endsOn ? formatLocalDate(s.endsOn, locale) : t('subscription.noEnd')}</Row>
        <Row label={t('subscription.staff')}>{limit(d.usage.staff, s.staffLimitOverride ?? def.staffLimit)}</Row>
        <Row label={t('subscription.workers')}>{limit(d.usage.workers, s.workerLimitOverride ?? def.workerLimit)}</Row>
        <Row label={t('subscription.branches')}>{limit(d.usage.branches, s.branchLimit)}</Row>
        <Row label={t('platform.org.extras')}>{extras.length ? extras.map((f) => t(`subscription.features.${f}`)).join(', ') : t('platform.org.none')}</Row>
      </CardContent>
    </Card>
  );
}

function Setup({ d }: { d: PlatformTenantDetail }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('platform.org.setup')}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <Row label={t('platform.org.sites')}>{d.counts.sites}</Row>
        <Row label={t('platform.org.teams')}>{d.counts.teams}</Row>
        <Row label={t('platform.org.checklists')}>{d.counts.checklists}</Row>
        <Row label={t('platform.org.assignments')}>{d.counts.assignments}</Row>
      </CardContent>
    </Card>
  );
}

function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="bg-card shadow-card grid gap-1 rounded-xl p-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  );
}

function Activity({ a, timezone }: { a: TenantActivity; timezone: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const pair = (p: { d7: number; d30: number }) => t('platform.org.d7d30', p);
  const periods = t('platform.org.periods');
  return (
    <section className="grid gap-4" aria-labelledby="org-activity">
      <h2 id="org-activity" className="text-lg font-semibold">
        {t('platform.org.activity')}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label={t('platform.org.lastActivity')} value={a.lastActivityAt ? formatDateTime(a.lastActivityAt, { locale, timeZone: timezone }) : t('platform.org.never')} />
        <Tile label={t('platform.org.activeUsers')} value={pair(a.activeUsers)} hint={periods} />
        <Tile label={t('platform.org.logins')} value={pair(a.logins)} hint={periods} />
        <Tile label={t('platform.org.runs')} value={pair(a.runsCompleted)} hint={periods} />
        <Tile label={t('platform.org.byClient')} value={`${a.activeByClient.web} / ${a.activeByClient.mobile}`} />
        <Tile label={t('platform.org.tasks')} value={a.tasksCreated30} />
        <Tile label={t('platform.org.reports')} value={a.problemReports30} />
      </div>
      <figure className="bg-card shadow-card grid gap-2 rounded-xl p-5">
        <figcaption className="font-medium">{t('platform.org.chart')}</figcaption>
        <div className="h-56" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} accessibilityLayer={false}>
              <CartesianGrid vertical={false} stroke={COLOR.grid} />
              <XAxis dataKey="date" tickFormatter={(d: string) => formatShortDate(d, locale)} tick={{ fontSize: 12, fill: COLOR.axis }} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis allowDecimals={false} width={32} tick={{ fontSize: 12, fill: COLOR.axis }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP} labelFormatter={(d) => formatLocalDate(String(d), locale)} />
              <Legend />
              <Bar dataKey="actions" name={t('platform.org.chartActions')} fill={COLOR.actions} radius={[3, 3, 0, 0]} />
              <Bar dataKey="runs" name={t('platform.org.chartRuns')} fill={COLOR.runs} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <Card>
        <CardHeader>
          <CardTitle>{t('platform.org.recent')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('platform.org.when')}</TableHead>
                <TableHead>{t('platform.org.who')}</TableHead>
                <TableHead>{t('platform.org.what')}</TableHead>
                <TableHead>{t('platform.org.app')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.recent.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(e.occurredAt, { locale, timeZone: timezone })}</TableCell>
                  <TableCell>{e.actor.type === 'user' ? (e.actor.name ?? '—') : e.actor.type === 'platform_admin' ? t('platform.org.staff') : t('platform.org.system')}</TableCell>
                  <TableCell>{t(`audit.actions.${e.action}`, { defaultValue: e.action })}</TableCell>
                  <TableCell>{e.client ? t(`audit.clients.${e.client}`) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
