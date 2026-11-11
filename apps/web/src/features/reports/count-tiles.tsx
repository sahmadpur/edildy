import type { ReportSummary } from '@edildy/contracts';
import { intlLocale } from '@edildy/i18n';
import { Link } from '@tanstack/react-router';
import { Info } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { percentText, type TileKey, tileSearch } from './labels';
import type { ReportSearch } from './search';
import { useLocale } from '@/lib/i18n';

const TILE = 'bg-card shadow-card grid content-start gap-1 rounded-xl p-4';

const COUNT_TILE = cn(TILE, 'text-left hover:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none');

/**
 * Spec §6.1: one tile per count, then completion % and average score. A tile is named "label: value", so the number
 * is part of what a screen reader announces. On the reports page a tile links to `/reports?tab=runs&bucket=…` with
 * the same filters; with `onSelect` (the home page) it is a toggle button and the page shows the runs itself.
 */
export function CountTiles({
  summary,
  search,
  keys,
  onSelect,
  selected = null,
}: {
  summary: ReportSummary;
  search: ReportSearch;
  keys: readonly TileKey[];
  onSelect?: (key: TileKey) => void;
  selected?: TileKey | null;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hintId = useId();
  const count = new Intl.NumberFormat(intlLocale(locale));
  const completion = t('reports.measures.completionPercent');
  const average = t('reports.measures.averageScore');
  const hint = t('reports.measures.completionHint');
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
      {keys.map((key) => {
        const label = t(`reports.counts.${key}`);
        const value = count.format(summary.counts[key]);
        const name = t('reports.tiles.link', { label, value });
        const body = (
          <>
            <span className="text-muted-foreground text-sm">{label}</span>
            <span className="text-[28px] leading-none font-semibold tabular-nums">{value}</span>
          </>
        );
        return onSelect ? (
          <button key={key} type="button" aria-label={name} aria-pressed={selected === key} onClick={() => onSelect(key)} className={cn(COUNT_TILE, selected === key && 'ring-primary ring-2')}>
            {body}
          </button>
        ) : (
          <Link key={key} to="/reports" search={tileSearch(search, key)} aria-label={name} className={COUNT_TILE}>
            {body}
          </Link>
        );
      })}
      <div role="group" aria-label={completion} aria-describedby={hintId} className={TILE}>
        <span className="text-muted-foreground flex items-center gap-1 text-sm">
          {completion}
          {/* No tooltip component in the repo: the title shows on hover, the description reaches screen readers (decision 7). */}
          <span title={hint} className="inline-flex">
            <Info className="size-3.5" aria-hidden />
          </span>
        </span>
        <span className="text-[28px] leading-none font-semibold tabular-nums">{percentText(t, summary.completionPercent, locale)}</span>
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      </div>
      <div role="group" aria-label={average} className={TILE}>
        <span className="text-muted-foreground text-sm">{average}</span>
        <span className="text-[28px] leading-none font-semibold tabular-nums">{percentText(t, summary.averageScore, locale)}</span>
      </div>
    </div>
  );
}
