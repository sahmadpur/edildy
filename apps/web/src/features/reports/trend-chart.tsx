import type { ReportTrendDay } from '@edildy/contracts';
import { formatShortDate } from '@edildy/i18n';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatLocalDate } from '@/features/scheduling/labels';
import { useLocale } from '@/lib/i18n';

/** Status tokens from packages/brand, so the bars match the status chips and both themes apply. */
export const CHART_COLOR = {
  planned: 'var(--tp-planned-solid)',
  completed: 'var(--tp-ok-solid)',
  late: 'var(--tp-late-solid)',
  grid: 'var(--tp-line)',
  axis: 'var(--tp-ink2)',
} as const;
const TICK = { fontSize: 12, fill: CHART_COLOR.axis };
export const TOOLTIP_STYLE = { background: 'var(--tp-surface-raised)', border: '1px solid var(--tp-line)', borderRadius: 10, color: 'var(--tp-ink)', boxShadow: 'var(--tp-shadow-raised)' };
const MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };
const SERIES = ['planned', 'completed', 'late'] as const;
const BAR = { radius: [4, 4, 0, 0] as [number, number, number, number], maxBarSize: 18, isAnimationActive: false };

/**
 * Per day: planned, completed and late, three bars side by side (feedback 2026-11-14). The chart is decoration for
 * sighted users; the hidden table carries the same numbers.
 */
export function TrendChart({ trend }: { trend: readonly ReportTrendDay[] }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const titleId = useId();
  if (trend.length < 2) return null;

  const tick = (date: string) => formatShortDate(date, locale);
  const day = (date: unknown) => formatLocalDate(String(date), locale);
  const data = trend.map((d) => ({ ...d }));
  const label = { planned: t('reports.chart.planned'), completed: t('reports.chart.completed'), late: t('reports.chart.late') };

  return (
    <figure aria-labelledby={titleId} className="bg-card shadow-card grid grid-rows-[auto_1fr] gap-2 rounded-xl p-5">
      <figcaption id={titleId} className="font-medium">
        {t('reports.trend')}
      </figcaption>
      <div className="h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={MARGIN} barGap={2} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke={CHART_COLOR.grid} />
            <XAxis dataKey="date" tickFormatter={tick} tick={TICK} axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} width={32} />
            <Tooltip labelFormatter={day} cursor={{ fill: 'var(--muted)' }} contentStyle={TOOLTIP_STYLE} />
            {/* In the bars' order, not alphabetical (recharts' default). */}
            <Legend iconType="circle" iconSize={8} itemSorter={(item) => SERIES.indexOf(item.dataKey as (typeof SERIES)[number])} />
            <Bar dataKey="planned" name={label.planned} fill={CHART_COLOR.planned} {...BAR} />
            <Bar dataKey="completed" name={label.completed} fill={CHART_COLOR.completed} {...BAR} />
            <Bar dataKey="late" name={label.late} fill={CHART_COLOR.late} {...BAR} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{t('reports.chart.table')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('reports.columns.date')}</th>
            <th scope="col">{label.planned}</th>
            <th scope="col">{label.completed}</th>
            <th scope="col">{label.late}</th>
          </tr>
        </thead>
        <tbody>
          {trend.map((d) => (
            <tr key={d.date}>
              <td>{formatLocalDate(d.date, locale)}</td>
              <td>{d.planned}</td>
              <td>{d.completed}</td>
              <td>{d.late}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
