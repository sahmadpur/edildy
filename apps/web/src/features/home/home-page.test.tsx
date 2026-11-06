import { ApiError } from '@taskop/api-client';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixedSizeCharts } from '@/features/reports/chart-test-setup';
import { meWith, reportSummary, TODAY, VIEWER } from '@/features/reports/fixtures';
import { queryClient as appQueryClient } from '@/lib/query';
import { renderWithRouter } from '@/test/router';
import { HomeDashboard } from './home-dashboard';
import { HomePage } from './home-page';

const mocks = vi.hoisted(() => ({
  me: { current: null as unknown },
  api: { reports: { summary: vi.fn() } },
}));
vi.mock('@/lib/session', () => ({
  api: mocks.api,
  useMe: () => mocks.me.current,
  useCan: (...keys: string[]) => keys.every((k) => (mocks.me.current as { permissions: string[] }).permissions.includes(k)),
}));

vi.mock('recharts', async (original) => fixedSizeCharts(await original<object>()));

/** The app's own query defaults (30 s stale, no focus refetch), so these tests pin the home page's overrides. */
const appClient = () => new QueryClient({ defaultOptions: { ...appQueryClient.getDefaultOptions(), queries: { ...appQueryClient.getDefaultOptions().queries, retry: false } } });

const PERIODS = ['Bu gün', 'Dünən', 'Bu həftə', 'Bu ay', 'Son 7 gün', 'Son 30 gün'];

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.resetAllMocks();
  mocks.me.current = meWith(VIEWER);
  mocks.api.reports.summary.mockResolvedValue(reportSummary());
});

afterEach(() => {
  vi.useRealTimers();
  focusManager.setFocused(undefined);
});

describe('HomePage', () => {
  it('keeps the welcome page for users without reports.view and asks for no report', async () => {
    mocks.me.current = meWith(['tasks.view']);
    renderWithRouter(<HomePage />);
    expect(await screen.findByRole('heading', { name: 'Xoş gəlmisiniz, Leyla!' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ana səhifə' })).not.toBeInTheDocument();
    expect(mocks.api.reports.summary).not.toHaveBeenCalled();
  });

  it('shows the home dashboard to holders of reports.view', async () => {
    renderWithRouter(<HomePage />);
    expect(await screen.findByRole('heading', { name: 'Ana səhifə' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.api.reports.summary).toHaveBeenCalledTimes(6));
    expect(screen.queryByRole('heading', { name: 'Xoş gəlmisiniz, Leyla!' })).not.toBeInTheDocument();
  });
});

describe('HomeDashboard', () => {
  it('shows one block of tiles per period, from today down to the last 30 days, with no period picker', async () => {
    renderWithRouter(<HomeDashboard today={TODAY} />);
    expect(await screen.findByRole('heading', { name: 'Ana səhifə' })).toBeInTheDocument();
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(PERIODS);
    expect(screen.queryByLabelText('Dövr')).not.toBeInTheDocument();
    expect(screen.queryByText('Diqqət tələb edir')).not.toBeInTheDocument();

    expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: TODAY, to: TODAY });
    expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-11-03', to: '2026-11-03' });
    expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-11-02', to: TODAY });
    expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-11-01', to: TODAY });
    expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-10-29', to: TODAY });
    expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-10-06', to: TODAY });

    const today = screen.getByRole('region', { name: 'Bu gün' });
    expect(await within(today).findByRole('link', { name: 'Planlaşdırılıb: 12' })).toBeInTheDocument();
    for (const name of ['Tamamlanıb: 7', 'Davam edir: 1', 'Gecikib: 1', 'Problemli: 2']) expect(within(today).getByRole('link', { name })).toBeInTheDocument();
    expect(within(today).getByRole('group', { name: 'Tamamlanma faizi' })).toHaveTextContent('70%');
    // One day: no trend. A week: a trend.
    expect(within(today).queryByRole('figure')).not.toBeInTheDocument();
    const week = screen.getByRole('region', { name: 'Son 7 gün' });
    expect(await within(week).findByRole('figure', { name: 'Gündəlik icra' })).toBeInTheDocument();
  });

  it("names each block's dates", async () => {
    renderWithRouter(<HomeDashboard today={TODAY} />);
    const today = await screen.findByRole('region', { name: 'Bu gün' });
    expect(within(today).getByRole('heading', { level: 2 })).toHaveTextContent(/^Bu gün Ç\., 4 noy 2026$/);
    const week = screen.getByRole('region', { name: 'Son 7 gün' });
    expect(within(week).getByRole('heading', { level: 2 })).toHaveTextContent(/^Son 7 gün .*29 okt 2026 – .*4 noy 2026$/);
  });

  it("carries the block's period to the runs report", async () => {
    renderWithRouter(<HomeDashboard today={TODAY} />);
    const week = await screen.findByRole('region', { name: 'Son 7 gün' });
    const href = new URL((await within(week).findByRole('link', { name: 'Gecikib: 1' })).getAttribute('href')!, 'http://localhost');
    expect(href.pathname).toBe('/reports');
    expect(Object.fromEntries(href.searchParams)).toEqual({ period: 'last_7', tab: 'runs', bucket: 'overdue' });
  });

  it("resolves the periods from the tenant's today, not the browser's", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 01:30 on 5 November in Baku; 16:30 on 4 November in New York.
    vi.setSystemTime(new Date('2026-11-04T21:30:00Z'));
    renderWithRouter(<HomeDashboard />);
    await waitFor(() => expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-11-02', to: '2026-11-05' }));
    cleanup();
    mocks.api.reports.summary.mockClear();
    mocks.me.current = meWith(VIEWER, { timezone: 'America/New_York' });
    renderWithRouter(<HomeDashboard />);
    await waitFor(() => expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-11-02', to: '2026-11-04' }));
    expect(mocks.api.reports.summary).not.toHaveBeenCalledWith({ from: '2026-11-05', to: '2026-11-05' });
  });

  it('asks again every minute while the page is visible, not while it is hidden, and at once when it comes back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithRouter(<HomeDashboard today={TODAY} />, '/', appClient());
    await screen.findAllByRole('link', { name: 'Gecikib: 1' });
    expect(mocks.api.reports.summary).toHaveBeenCalledTimes(6);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    await waitFor(() => expect(mocks.api.reports.summary).toHaveBeenCalledTimes(12));

    act(() => focusManager.setFocused(false));
    await act(() => vi.advanceTimersByTimeAsync(180_000));
    expect(mocks.api.reports.summary).toHaveBeenCalledTimes(12);
    act(() => focusManager.setFocused(true));
    await waitFor(() => expect(mocks.api.reports.summary).toHaveBeenCalledTimes(18));
  });

  it('moves Today to the new day when the page stays open over midnight', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 23:59:30 in Baku.
    vi.setSystemTime(new Date('2026-11-04T19:59:30Z'));
    renderWithRouter(<HomeDashboard />, '/', appClient());
    await waitFor(() => expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-11-04', to: '2026-11-04' }));
    expect(mocks.api.reports.summary).not.toHaveBeenCalledWith({ from: '2026-11-05', to: '2026-11-05' });
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    await waitFor(() => expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-11-05', to: '2026-11-05' }));
  });

  it('refreshes every block on demand and says when the numbers were last updated', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 12:15 in Baku.
    vi.setSystemTime(new Date('2026-11-04T08:15:00Z'));
    renderWithRouter(<HomeDashboard today={TODAY} />);
    expect(await screen.findByText('Son yenilənmə: 12:15')).toBeInTheDocument();
    expect(mocks.api.reports.summary).toHaveBeenCalledTimes(6);
    vi.setSystemTime(new Date('2026-11-04T08:17:00Z'));
    await userEvent.click(screen.getByRole('button', { name: 'Yenilə' }));
    await waitFor(() => expect(mocks.api.reports.summary).toHaveBeenCalledTimes(12));
    expect(await screen.findByText('Son yenilənmə: 12:17')).toBeInTheDocument();
  });

  it('shows why a block could not be loaded', async () => {
    mocks.api.reports.summary.mockRejectedValue(new ApiError(503, 'REPORT_TIMEOUT', 'errors.REPORT_TIMEOUT'));
    renderWithRouter(<HomeDashboard today={TODAY} />);
    expect(await screen.findAllByText('Hesabat vaxtında hazırlanmadı. Dövrü qısaldın və ya bir az sonra yenidən cəhd edin.')).toHaveLength(6);
  });
});
