import {
  type PeriodPreset,
  type ReportFiltersQuery as ReportFilters,
  type ReportSummary,
  resolvePeriod,
  type RunBucket,
  type RunCountKey,
} from '@taskop/contracts';
import { formatCompactDate, intlLocale } from '@taskop/i18n';
import { useQueries, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { isSingleDay, percentText } from '@/features/reports/labels';
import { reportKeys, summaryQueryOptions } from '@/features/reports/queries';
import { RunsTab } from '@/features/reports/runs-tab';
import { useTenantToday, useTimeFormat } from '@/features/scheduling/labels';
import { errorText } from '@/lib/errors';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** The four boxes, left to right. */
export const HOME_PERIODS: readonly PeriodPreset[] = ['today', 'yesterday', 'last_7', 'last_30'];
export const DEFAULT_HOME_PERIOD: PeriodPreset = 'today';
export const DEFAULT_HOME_BUCKET: RunBucket = 'all';

/** A figure is a toggle: a saffron rule under the number says which list is open; hover and focus show the same rule faintly. */
const PRESSABLE =
  'border-b-2 border-transparent transition-colors group-hover:border-saffron/40 hover:border-saffron/40 group-focus-visible:border-saffron focus-visible:border-saffron';
const PRESSED = 'border-saffron! ';

/** A box's figures: the count shown, the runs list it opens, and the colour of its number. */
type BoxStat = {
  key: Extract<RunCountKey, 'planned' | 'completed' | 'withProblems' | 'overdue'>;
  bucket: RunBucket;
  labelKey: string;
  tone: string;
};
const PLANNED: BoxStat = {
  key: 'planned',
  bucket: 'planned',
  labelKey: 'reports.home.planned',
  tone: 'text-foreground',
};
const OUTCOMES: readonly BoxStat[] = [
  {
    key: 'completed',
    bucket: 'completed',
    labelKey: 'reports.home.completed',
    tone: 'text-status-ok-text',
  },
  {
    key: 'withProblems',
    bucket: 'problems',
    labelKey: 'reports.home.problems',
    tone: 'text-status-bad-text',
  },
  { key: 'overdue', bucket: 'overdue', labelKey: 'reports.home.late', tone: 'text-status-late-text' },
];

/**
 * The web home page for reports.view holders. Four boxes (today, yesterday, the last 7 and 30 days) each carry the
 * period's planned, completed, with-problems and late counts, all live at once. One box is selected (today on
 * arrival); its completion %, average score and runs table sit under the boxes. A count inside a box selects its
 * period and opens that count's runs. Nothing here leaves the page. The numbers are
 * polled every minute while visible; "today" is read on every render, so a page left open past midnight moves on
 * with the next poll (reports decision 10).
 */
export function HomeDashboard({ today: fixedToday }: { today?: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const time = useTimeFormat();
  const tenantToday = useTenantToday();
  const today = fixedToday ?? tenantToday;
  const boxes = HOME_PERIODS.map((period) => ({
    period,
    filters: resolvePeriod(period, today) as ReportFilters,
  }));
  const results = useQueries({ queries: boxes.map((b) => summaryQueryOptions(b.filters, { live: true })) });
  const updatedAt = Math.max(0, ...results.map((r) => r.dataUpdatedAt));
  const fetching = results.some((r) => r.isFetching);
  const [selected, setSelected] = useState<PeriodPreset>(DEFAULT_HOME_PERIOD);
  const [bucket, setBucket] = useState<RunBucket>(DEFAULT_HOME_BUCKET);
  const index = boxes.findIndex((b) => b.period === selected);
  const current = boxes[index]!;
  const currentQuery = results[index]!;
  const pick = (period: PeriodPreset, b?: RunBucket) => {
    setSelected(period);
    if (b) setBucket(b);
  };

  return (
    <div className="grid gap-5">
      <PageHeader
        title={t('nav.home')} description={t('pages.home')}
        actions={
          <>
            {updatedAt > 0 && (
              <span className="text-muted-foreground self-center text-sm">
                {t('reports.live.updatedAt', { time: time(new Date(updatedAt).toISOString()) })}
              </span>
            )}
            <Button
              variant="outline"
              disabled={fetching}
              onClick={() => void qc.invalidateQueries({ queryKey: reportKeys.all })}
            >
              <RefreshCw className={cn('size-4', fetching && 'animate-spin')} aria-hidden />
              {t('reports.live.refresh')}
            </Button>
          </>
        }
      />
      <div
        role="group"
        aria-label={t('reports.home.periods')}
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        {boxes.map((b, i) => (
          <PeriodBox
            key={b.period}
            period={b.period}
            filters={b.filters}
            query={results[i]!}
            selected={b.period === selected}
            bucket={bucket}
            onPick={pick}
          />
        ))}
      </div>
      <PeriodDetail
        period={current.period}
        filters={current.filters}
        query={currentQuery}
        bucket={bucket}
        onBucket={setBucket}
      />
    </div>
  );
}

function useRangeText(filters: ReportFilters): string {
  const { t } = useTranslation();
  const locale = useLocale();
  return isSingleDay(filters)
    ? formatCompactDate(filters.from, locale)
    : t('reports.range.label', {
        from: formatCompactDate(filters.from, locale),
        to: formatCompactDate(filters.to, locale),
      });
}

function PeriodBox({
  period,
  filters,
  query,
  selected,
  bucket,
  onPick,
}: {
  period: PeriodPreset;
  filters: ReportFilters;
  query: UseQueryResult<ReportSummary>;
  selected: boolean;
  bucket: RunBucket;
  onPick: (period: PeriodPreset, bucket?: RunBucket) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const number = new Intl.NumberFormat(intlLocale(locale));
  const label = t(`reports.periods.${period}`);
  const range = useRangeText(filters);
  const counts = query.data?.counts;
  const value = (key: BoxStat['key']) => (counts ? number.format(counts[key]) : t('reports.noValue'));
  const statName = (s: BoxStat) => t('reports.tiles.link', { label: t(s.labelKey), value: value(s.key) });
  const pressed = (s: BoxStat) => selected && bucket === s.bucket;
  return (
    <article
      aria-label={label}
      className={cn(
        'bg-card shadow-card relative grid gap-4 rounded-xl p-4 pt-5 transition-shadow',
        'before:absolute before:inset-x-4 before:top-0 before:h-0.75 before:rounded-b before:transition-colors',
        selected
          ? 'ring-primary before:bg-saffron shadow-raised ring-2 after:bg-card after:border-primary after:absolute after:-bottom-2 after:left-1/2 after:size-3.5 after:-translate-x-1/2 after:rotate-45 after:border-r-2 after:border-b-2'
          : 'before:bg-transparent hover:shadow-raised',
      )}
    >
      {/* The heading is the box's own button and stretches over the whole card; the counts below sit on top of it. */}
      {/* One line: "Bu gün | 6 Noy 26". The date is part of the box's name, not a caption under it. */}
      <h2 className="flex flex-wrap items-baseline gap-x-2 leading-tight">
        <button
          type="button"
          aria-pressed={selected}
          aria-label={t('reports.home.selectPeriod', { period: label })}
          onClick={() => onPick(period)}
          className="focus-visible:ring-ring rounded-md text-left text-base leading-tight font-semibold after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2"
        >
          {label}
        </button>{' '}
        <span className="text-muted-foreground text-sm font-normal" aria-hidden>
          |
        </span>{' '}
        <span className="text-muted-foreground text-sm font-normal tabular-nums">{range}</span>
      </h2>
      {query.error && <p className="text-destructive relative text-sm">{errorText(t, query.error)}</p>}
      <button
        type="button"
        aria-label={statName(PLANNED)}
        aria-pressed={pressed(PLANNED)}
        onClick={() => onPick(period, PLANNED.bucket)}
        className="group relative grid w-fit justify-items-start gap-0.5 rounded-md text-left focus-visible:outline-none"
      >
        <span
          className={cn(
            'text-[32px] leading-none font-semibold tabular-nums',
            !counts && 'text-muted-foreground',
            PRESSABLE,
            pressed(PLANNED) && PRESSED,
          )}
        >
          {value(PLANNED.key)}
        </span>
        <span className="text-muted-foreground text-xs">{t(PLANNED.labelKey)}</span>
      </button>
      <dl className="relative grid grid-cols-3 gap-2 border-t pt-3">
        {OUTCOMES.map((s) => (
          <div key={s.key} className="grid">
            <dd className="order-1">
              <button
                type="button"
                aria-label={statName(s)}
                aria-pressed={pressed(s)}
                onClick={() => onPick(period, s.bucket)}
                className={cn(
                  'rounded-md text-xl leading-none font-semibold tabular-nums focus-visible:outline-none',
                  counts ? s.tone : 'text-muted-foreground',
                  PRESSABLE,
                  pressed(s) && PRESSED,
                )}
              >
                {value(s.key)}
              </button>
            </dd>
            <dt className="text-muted-foreground order-2 mt-1 text-xs">{t(s.labelKey)}</dt>
          </div>
        ))}
      </dl>
    </article>
  );
}

function PeriodDetail({
  period,
  filters,
  query,
  bucket,
  onBucket,
}: {
  period: PeriodPreset;
  filters: ReportFilters;
  query: UseQueryResult<ReportSummary>;
  bucket: RunBucket;
  onBucket: (bucket: RunBucket) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const label = t(`reports.periods.${period}`);
  const range = useRangeText(filters);
  const summary = query.data;
  const measures = [
    {
      key: 'completionPercent',
      name: t('reports.measures.completionPercent'),
      value: summary?.completionPercent ?? null,
      hint: t('reports.measures.completionHint'),
    },
    {
      key: 'averageScore',
      name: t('reports.measures.averageScore'),
      value: summary?.averageScore ?? null,
      hint: undefined,
    },
  ] as const;
  return (
    <section aria-label={label} className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-1">
        <h2 className="flex flex-wrap items-baseline gap-x-2 text-lg font-semibold">
          {label}{' '}
          <span className="text-muted-foreground text-sm font-normal" aria-hidden>
            |
          </span>{' '}
          <span className="text-muted-foreground text-sm font-normal tabular-nums">{range}</span>
        </h2>
        {summary && (
          <dl className="flex flex-wrap gap-x-6 gap-y-1">
            {measures.map((m) => (
              <div
                key={m.key}
                role="group"
                aria-label={m.name}
                title={m.hint}
                className="flex items-baseline gap-2"
              >
                <dt className="text-muted-foreground text-sm">{m.name}</dt>
                <dd className="text-lg leading-none font-semibold tabular-nums">
                  {percentText(t, m.value, locale)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {query.error && <p className="text-destructive">{errorText(t, query.error)}</p>}
      {!summary && !query.error && <LoadingState />}
      <div className="bg-card shadow-card grid gap-4 rounded-xl p-5">
        <RunsTab filters={filters} bucket={bucket} onBucket={onBucket} />
      </div>
    </section>
  );
}
