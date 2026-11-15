import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/router';
import { CountTiles } from './count-tiles';
import { IDS, reportSummary } from './fixtures';
import { DASHBOARD_TILES, SUMMARY_TILES } from './labels';

vi.mock('@/lib/session', () => ({
  useFeature: () => true,
  useFeatureOrStaff: () => true, useMe: () => ({ tenant: { timezone: 'Asia/Baku', locale: 'az' } }) }));

/** The path and the query of a tile's link. */
function target(name: string) {
  const url = new URL(screen.getByRole('link', { name }).getAttribute('href')!, 'http://localhost');
  return { path: url.pathname, search: Object.fromEntries(url.searchParams) };
}

describe('CountTiles', () => {
  it('links every count to the runs report of its bucket, with the same filters', async () => {
    const search = { period: 'custom', from: '2026-11-01', to: '2026-11-15', siteId: IDS.zoneA, inactive: true } as const;
    renderWithRouter(<CountTiles summary={reportSummary()} search={search} keys={SUMMARY_TILES} />);
    await screen.findByRole('link', { name: 'Planlanmış: 4' });
    const same = { period: 'custom', from: '2026-11-01', to: '2026-11-15', siteId: IDS.zoneA, inactive: 'true', tab: 'runs' };
    expect(target('Planlanmış: 4')).toEqual({ path: '/reports', search: { ...same, bucket: 'planned' } });
    expect(target('Tamamlanan: 7').search).toEqual({ ...same, bucket: 'completed' });
    expect(target('Gecikən: 1').search).toEqual({ ...same, bucket: 'late' });
    expect(target('Problemli: 2').search).toEqual({ ...same, bucket: 'problems' });
  });

  it('offers the counts as buttons that report the chosen tile, when asked to', async () => {
    const onSelect = vi.fn();
    renderWithRouter(<CountTiles summary={reportSummary()} search={{ period: 'last_7' }} keys={DASHBOARD_TILES} onSelect={onSelect} selected="late" />);
    expect(await screen.findByRole('button', { name: 'Gecikən: 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Planlanmış: 4' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Planlanmış: 4' }));
    expect(onSelect).toHaveBeenCalledWith('planned');
  });

  it('shows the completion and the average score, explains completion, and a dash when there is none', async () => {
    renderWithRouter(<CountTiles summary={reportSummary()} search={{}} keys={DASHBOARD_TILES} />);
    const completion = await screen.findByRole('group', { name: 'Tamamlanma faizi' });
    expect(completion).toHaveTextContent('70%');
    expect(completion).toHaveAccessibleDescription('Vaxtı çatmış yoxlamalardan tamamlananların payı');
    expect(screen.getByRole('group', { name: 'Orta bal' })).toHaveTextContent('87,5%');
    // The three Göstəricilər and Problemli only.
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.queryByRole('link', { name: /^Yarımçıq/ })).not.toBeInTheDocument();
    cleanup();
    renderWithRouter(<CountTiles summary={reportSummary({ completionPercent: null, averageScore: null })} search={{}} keys={DASHBOARD_TILES} />);
    expect(await screen.findByRole('group', { name: 'Tamamlanma faizi' })).toHaveTextContent('—');
    expect(screen.getByRole('group', { name: 'Orta bal' })).toHaveTextContent('—');
  });
});
