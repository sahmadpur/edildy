import type { RunCountKey, RunCounts } from '@taskop/contracts';
import { intlLocale } from '@taskop/i18n';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** The planned runs split by what became of them, in the order they are stacked; the brand's status set colours them. */
const SEGMENTS: readonly { key: Extract<RunCountKey, 'completed' | 'inProgress' | 'pending' | 'overdue' | 'partial' | 'missed'>; bar: string; dot: string }[] = [
  { key: 'completed', bar: 'bg-status-ok', dot: 'bg-status-ok' },
  { key: 'inProgress', bar: 'bg-status-active', dot: 'bg-status-active' },
  { key: 'pending', bar: 'bg-status-planned', dot: 'bg-status-planned' },
  { key: 'overdue', bar: 'bg-status-late', dot: 'bg-status-late' },
  { key: 'partial', bar: 'bg-status-audit', dot: 'bg-status-audit' },
  { key: 'missed', bar: 'bg-status-bad', dot: 'bg-status-bad' },
];

/**
 * One segmented bar for the period's planned runs: each status a slice, a 2 px gap between slices, and a legend with
 * the counts underneath, so colour is never the only carrier. Plain HTML: no chart library, nothing to animate.
 */
export function StatusBreakdown({ counts }: { counts: RunCounts }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const titleId = useId();
  const number = new Intl.NumberFormat(intlLocale(locale));
  const total = SEGMENTS.reduce((sum, s) => sum + counts[s.key], 0);
  const shown = SEGMENTS.filter((s) => counts[s.key] > 0);
  return (
    <figure aria-labelledby={titleId} className="grid gap-3">
      <figcaption id={titleId} className="font-medium">
        {t('reports.home.breakdown')}
      </figcaption>
      {total === 0 ? (
        <p className="text-muted-foreground text-sm">{t('reports.home.noRuns')}</p>
      ) : (
        <div className="bg-muted flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden title={t('reports.home.breakdownHint')}>
          {shown.map((s) => (
            <div key={s.key} className={cn('h-full min-w-1 rounded-xs first:rounded-l-full last:rounded-r-full', s.bar)} style={{ flexGrow: counts[s.key] }} />
          ))}
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
        {SEGMENTS.map((s) => (
          <div key={s.key} className={cn('flex items-baseline justify-between gap-2', counts[s.key] === 0 && 'text-muted-foreground')}>
            <dt className="flex items-center gap-1.5">
              <span className={cn('inline-block size-2 shrink-0 rounded-full', counts[s.key] === 0 ? 'bg-border' : s.dot)} aria-hidden />
              {t(`reports.counts.${s.key}`)}
            </dt>
            <dd className="font-medium tabular-nums">{number.format(counts[s.key])}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
