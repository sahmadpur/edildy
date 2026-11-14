import type { ReportFiltersQuery as ReportFilters, ReportSummary } from '@edildy/contracts';
import { useTranslation } from 'react-i18next';
import { errorText } from '@/lib/errors';
import { CountTiles } from './count-tiles';
import { isSingleDay, SUMMARY_TILES, type TileKey } from './labels';
import { useReportSummary } from './queries';
import type { ReportSearch } from './search';
import { StatusPie } from './status-pie';
import { TrendChart } from './trend-chart';
import { LoadingState, EmptyState } from '@/components/states';

/** Tiles and trend: the home page and the Summary tab show the same components (spec §6.2). */
export function SummaryView({
  summary,
  search,
  filters,
  tiles,
  onSelectTile,
  selectedTile,
}: {
  summary: ReportSummary;
  search: ReportSearch;
  filters: ReportFilters;
  tiles: readonly TileKey[];
  /** Home page: tiles are toggles rather than links (see CountTiles). */
  onSelectTile?: (key: TileKey) => void;
  selectedTile?: TileKey | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4">
      <CountTiles summary={summary} search={search} keys={tiles} onSelect={onSelectTile} selected={selectedTile} />
      {summary.counts.planned === 0 && <EmptyState title={t('reports.empty')} />}
      {summary.counts.planned > 0 &&
        (isSingleDay(filters) ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <StatusPie counts={summary.counts} />
          </div>
        ) : (
          // The bars and the ring side by side, the same height (feedback 2026-11-14).
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <TrendChart trend={summary.trend} />
            <StatusPie counts={summary.counts} />
          </div>
        ))}
    </div>
  );
}

export function SummaryTab({ search, filters }: { search: ReportSearch; filters: ReportFilters }) {
  const { t } = useTranslation();
  const summary = useReportSummary(filters);
  if (summary.error) return <p className="text-destructive">{errorText(t, summary.error)}</p>;
  if (!summary.data) return <LoadingState />;
  return <SummaryView summary={summary.data} search={search} filters={filters} tiles={SUMMARY_TILES} />;
}
