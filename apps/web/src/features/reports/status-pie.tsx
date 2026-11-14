import type { RunCounts } from '@edildy/contracts';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useLocale } from '@/lib/i18n';
import { CHART_COLOR, TOOLTIP_STYLE } from './trend-chart';

/** Late = not done on time and not completed: overdue now, or missed (feedback 2026-11-14). */
export const lateCount = (c: Pick<RunCounts, 'overdue' | 'missed'>) => c.overdue + c.missed;

/** Completed vs late for the period, as a ring with the counts and shares beside it. */
export function StatusPie({ counts }: { counts: RunCounts }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const titleId = useId();
  const slices = [
    { key: 'completed', label: t('reports.chart.completed'), value: counts.completed, color: CHART_COLOR.completed },
    { key: 'late', label: t('reports.chart.late'), value: lateCount(counts), color: CHART_COLOR.late },
  ] as const;
  const total = slices[0].value + slices[1].value;
  const share = (v: number) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(total ? v / total : 0);

  return (
    <figure aria-labelledby={titleId} className="bg-card shadow-card grid grid-rows-[auto_1fr] gap-2 rounded-xl p-5">
      <figcaption id={titleId} className="font-medium" title={t('reports.chart.lateHint')}>
        {t('reports.chart.pie')}
      </figcaption>
      {total === 0 ? (
        <p className="text-muted-foreground grid h-64 place-items-center text-center text-sm">{t('reports.chart.pieEmpty')}</p>
      ) : (
        <div className="grid h-64 grid-rows-[1fr_auto] gap-3">
          <div aria-hidden className="min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart accessibilityLayer={false}>
                <Pie data={[...slices]} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="90%" paddingAngle={slices.every((s) => s.value > 0) ? 2 : 0} stroke="none" isAnimationActive={false}>
                  {slices.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {slices.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="ml-auto font-medium tabular-nums">
                  {s.value} · {share(s.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}
