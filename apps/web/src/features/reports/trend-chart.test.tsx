import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { formatLocalDate } from '@/features/scheduling/labels';
import { renderWithProviders } from '@/test/render';
import { fixedSizeCharts } from './chart-test-setup';
import { reportSummary, TODAY } from './fixtures';
import { StatusPie } from './status-pie';
import { TrendChart } from './trend-chart';

vi.mock('@/lib/session', () => ({
  useFeature: () => true,
  useFeatureOrStaff: () => true, useMe: () => ({ tenant: { timezone: 'Asia/Baku', locale: 'az' } }) }));
vi.mock('recharts', async (original) => fixedSizeCharts(await original<object>()));

describe('TrendChart', () => {
  it('draws planned, completed and late per day, and gives the same numbers as a table', () => {
    renderWithProviders(<TrendChart trend={reportSummary().trend} />);
    const figure = screen.getByRole('figure', { name: 'Gündəlik yoxlamalar' });
    const rows = within(within(figure).getByRole('table', { name: 'Gündəlik yoxlama cədvəli' })).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(within(rows[0]!).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Tarix', 'Planlanan', 'Tamamlanan', 'Gecikən']);
    expect(within(rows[1]!).getAllByRole('cell').map((c) => c.textContent)).toEqual([formatLocalDate('2026-11-02'), '5', '3', '1']);
    // A day with nothing planned is drawn as zero.
    expect(within(rows[2]!).getAllByRole('cell').map((c) => c.textContent)).toEqual([formatLocalDate('2026-11-03'), '0', '0', '0']);
    expect(within(rows[3]!).getAllByRole('cell').map((c) => c.textContent)).toEqual([formatLocalDate(TODAY), '7', '4', '0']);
  });

  it('draws nothing for a single day', () => {
    const { container } = renderWithProviders(<TrendChart trend={[{ date: TODAY, planned: 2, due: 2, completed: 1, late: 0, completionPercent: 50 }]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows completed against late (overdue + missed) beside the bars', () => {
    renderWithProviders(<StatusPie counts={reportSummary({ counts: { ...reportSummary().counts, completed: 6, overdue: 1, missed: 1 } }).counts} />);
    const figure = screen.getByRole('figure', { name: 'Tamamlanan və gecikən' });
    expect(within(figure).getByText('6 · 75%')).toBeInTheDocument();
    expect(within(figure).getByText('2 · 25%')).toBeInTheDocument();
  });
});
