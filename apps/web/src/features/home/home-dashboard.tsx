import { PERIOD_PRESETS, type PeriodPreset, type ReportFilters, resolvePeriod } from '@taskop/contracts';
import { useQueries, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { ReportSummary } from '@taskop/contracts';
import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { DASHBOARD_TILES, TILE_BUCKETS, type TileKey } from '@/features/reports/labels';
import { reportKeys, summaryQueryOptions } from '@/features/reports/queries';
import { RunsTable } from '@/features/reports/runs-tab';
import { SummaryView } from '@/features/reports/summary-view';
import { formatLocalDate, useTenantToday, useTimeFormat } from '@/features/scheduling/labels';
import { errorText } from '@/lib/errors';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * The web home page for reports.view holders: one block of live tiles per period preset, from today down to the last
 * 30 days, on one scrolling page. No filters here, and no leaving the page: a tile unfolds that count's runs right
 * under its block (one list open at a time). The numbers are polled every minute while visible and refreshed on
 * demand. "Today" is read on every render, so a page left open past midnight moves to the new day once the next poll
 * re-renders it (reports decision 10).
 */
export function HomeDashboard({ today: fixedToday }: { today?: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const time = useTimeFormat();
  const tenantToday = useTenantToday();
  const today = fixedToday ?? tenantToday;
  const blocks = PERIOD_PRESETS.map((period) => ({ period, filters: resolvePeriod(period, today) as ReportFilters }));
  const results = useQueries({ queries: blocks.map((b) => summaryQueryOptions(b.filters, { live: true })) });
  const updatedAt = Math.max(0, ...results.map((r) => r.dataUpdatedAt));
  const fetching = results.some((r) => r.isFetching);
  const [open, setOpen] = useState<{ period: PeriodPreset; tile: TileKey } | null>(null);
  const toggle = (period: PeriodPreset, tile: TileKey | null) => setOpen(tile === null || (open?.period === period && open.tile === tile) ? null : { period, tile });

  return (
    <div className="grid gap-8">
      <PageHeader
        title={t('nav.home')}
        actions={
          <>
            {updatedAt > 0 && <span className="text-muted-foreground self-center text-sm">{t('reports.live.updatedAt', { time: time(new Date(updatedAt).toISOString()) })}</span>}
            <Button variant="outline" disabled={fetching} onClick={() => void qc.invalidateQueries({ queryKey: reportKeys.all })}>
              <RefreshCw className={cn('size-4', fetching && 'animate-spin')} aria-hidden />
              {t('reports.live.refresh')}
            </Button>
          </>
        }
      />
      {blocks.map((b, i) => (
        <PeriodBlock key={b.period} period={b.period} filters={b.filters} query={results[i]!} selected={open?.period === b.period ? open.tile : null} onSelect={(tile) => toggle(b.period, tile)} />
      ))}
    </div>
  );
}

function PeriodBlock({
  period,
  filters,
  query,
  selected,
  onSelect,
}: {
  period: PeriodPreset;
  filters: ReportFilters;
  query: UseQueryResult<ReportSummary>;
  selected: TileKey | null;
  onSelect: (tile: TileKey | null) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const label = t(`reports.periods.${period}`);
  const range = filters.from === filters.to ? formatLocalDate(filters.from, locale) : t('reports.range.label', { from: formatLocalDate(filters.from, locale), to: formatLocalDate(filters.to, locale) });
  return (
    <section aria-label={label} className="grid gap-3">
      <h2 className="flex flex-wrap items-baseline gap-x-3 text-lg font-semibold">
        {label}{' '}
        <span className="text-muted-foreground text-sm font-normal tabular-nums">{range}</span>
      </h2>
      {query.error && <p className="text-destructive">{errorText(t, query.error)}</p>}
      {!query.data && !query.error && <LoadingState />}
      {query.data && <SummaryView summary={query.data} search={{ period }} filters={filters} tiles={DASHBOARD_TILES} onSelectTile={onSelect} selectedTile={selected} />}
      {selected && (
        <section aria-label={t(`reports.counts.${selected}`)} className="bg-card shadow-card grid gap-3 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">{t(`reports.counts.${selected}`)}</h3>
            <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
              <X aria-hidden />
              {t('common.close')}
            </Button>
          </div>
          <RunsTable filters={filters} bucket={TILE_BUCKETS[selected]} />
        </section>
      )}
    </section>
  );
}
