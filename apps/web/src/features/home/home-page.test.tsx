import { ApiError } from '@edildy/api-client';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { meWith, page, reportRun, reportSummary, TODAY, VIEWER } from '@/features/reports/fixtures';
import { queryClient as appQueryClient } from '@/lib/query';
import { renderWithRouter } from '@/test/router';
import { HomeDashboard } from './home-dashboard';
import { HomePage } from './home-page';

const mocks = vi.hoisted(() => ({
  me: { current: null as unknown },
  api: {
    reports: { summary: vi.fn(), runs: vi.fn() },
    occurrences: { get: vi.fn() },
    executions: { get: vi.fn() },
  },
}));
vi.mock('@/lib/session', () => ({
  api: mocks.api,
  useMe: () => mocks.me.current,
  useCan: (...keys: string[]) =>
    keys.every((k) => (mocks.me.current as { permissions: string[] }).permissions.includes(k)),
}));

/** The app's own query defaults (30 s stale, no focus refetch), so these tests pin the home page's overrides. */
const appClient = () =>
  new QueryClient({
    defaultOptions: {
      ...appQueryClient.getDefaultOptions(),
      queries: { ...appQueryClient.getDefaultOptions().queries, retry: false },
    },
  });

const PERIODS = ['Bu gün', 'Dünən', 'Son 7 gün', 'Son 30 gün'];
const boxes = async () => within(await screen.findByRole('group', { name: 'Dövrlər' }));
const box = async (name: string) => within((await boxes()).getByRole('article', { name }));
/** The detail section under the boxes: the only region named after a period. */
const detail = (name: string) => within(screen.getByRole('region', { name }));

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.resetAllMocks();
  mocks.me.current = meWith(VIEWER);
  mocks.api.reports.summary.mockResolvedValue(reportSummary());
  mocks.api.reports.runs.mockResolvedValue(page([reportRun()]));
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
    expect(screen.queryByRole('heading', { name: 'Göstəricilər' })).not.toBeInTheDocument();
    expect(mocks.api.reports.summary).not.toHaveBeenCalled();
  });

  it('shows the home dashboard to holders of reports.view', async () => {
    renderWithRouter(<HomePage />);
    expect(await screen.findByRole('heading', { name: 'Göstəricilər' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.api.reports.summary).toHaveBeenCalledTimes(4));
    expect(screen.queryByRole('heading', { name: 'Xoş gəlmisiniz, Leyla!' })).not.toBeInTheDocument();
  });
});

describe('HomeDashboard', () => {
  it('shows four boxes — today, yesterday, last 7 and last 30 days — each with planned, completed, problems and late', async () => {
    renderWithRouter(<HomeDashboard today={TODAY} />);
    expect(await screen.findByRole('heading', { name: 'Göstəricilər' })).toBeInTheDocument();
    expect((await boxes()).getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(PERIODS);
    expect(screen.queryByLabelText('Dövr')).not.toBeInTheDocument();

    expect(mocks.api.reports.summary).toHaveBeenCalledTimes(4);
    expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: TODAY, to: TODAY });
    expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-11-03', to: '2026-11-03' });
    expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-10-29', to: TODAY });
    expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-10-06', to: TODAY });

    const week = await box('Son 7 gün');
    expect(await week.findByRole('button', { name: 'Gələcək: 12' })).toBeInTheDocument();
    for (const name of ['Tamamlanan: 7', 'Problemli: 2', 'Gecikən: 1'])
      expect(week.getByRole('button', { name })).toBeInTheDocument();
    // Only the four figures: no in-progress tile, no percentages inside a box.
    expect(week.queryByRole('button', { name: /Davam edir/ })).not.toBeInTheDocument();
    expect(week.queryByText('Tamamlanma faizi')).not.toBeInTheDocument();
    expect(week.getByRole('heading', { level: 2 })).toHaveTextContent('Son 7 gün | 29 Okt 26 – 4 Noy 26');
  });

  it('selects today on arrival and shows its measures and runs under the boxes, every run first', async () => {
    renderWithRouter(<HomeDashboard today={TODAY} />);
    const today = await box('Bu gün');
    expect(await today.findByRole('button', { name: 'Bu gün dövrünü seç' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect((await box('Dünən')).getByRole('button', { name: 'Dünən dövrünü seç' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    const panel = detail('Bu gün');
    expect(panel.getByRole('heading', { level: 2 })).toHaveTextContent('Bu gün | 4 Noy 26');
    expect(await panel.findByRole('group', { name: 'Tamamlanma faizi' })).toHaveTextContent('70%');
    expect(panel.getByRole('group', { name: 'Orta bal' })).toHaveTextContent('87,5%');
    // No charts on the home page.
    expect(panel.queryByRole('figure')).not.toBeInTheDocument();
    expect(screen.queryByText('Yoxlamaların vəziyyəti')).not.toBeInTheDocument();
    expect(screen.queryByText('Gündəlik yoxlamalar')).not.toBeInTheDocument();

    // The runs table: Hamısı is the first chip and the one open on arrival.
    const chips = within(panel.getByRole('group', { name: 'Yoxlamalar' })).getAllByRole('button');
    expect(chips[0]).toHaveTextContent('Hamısı');
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
    expect(await panel.findByRole('row', { name: /Açılış yoxlaması/ })).toBeInTheDocument();
    expect(mocks.api.reports.runs).toHaveBeenCalledWith({ from: TODAY, to: TODAY, bucket: 'all' });
    expect(screen.queryByRole('region', { name: 'Son 7 gün' })).not.toBeInTheDocument();
  });

  it('switches the details to the clicked box; the URL stays on /', async () => {
    const router = renderWithRouter(<HomeDashboard today={TODAY} />);
    await userEvent.click(
      await (await box('Son 7 gün')).findByRole('button', { name: 'Son 7 gün dövrünü seç' }),
    );
    expect((await box('Son 7 gün')).getByRole('button', { name: 'Son 7 gün dövrünü seç' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect((await box('Bu gün')).getByRole('button', { name: 'Bu gün dövrünü seç' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    const panel = detail('Son 7 gün');
    expect(await panel.findByRole('group', { name: 'Tamamlanma faizi' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bu gün' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.api.reports.runs).toHaveBeenCalledWith({ from: '2026-10-29', to: TODAY, bucket: 'all' }),
    );
    expect(router.state.location.pathname).toBe('/');
  });

  it("a count inside a box selects its period and opens that count's runs; the bucket chips switch the list", async () => {
    renderWithRouter(<HomeDashboard today={TODAY} />);
    const late = await (await box('Son 30 gün')).findByRole('button', { name: 'Gecikən: 1' });
    await userEvent.click(late);
    expect(late).toHaveAttribute('aria-pressed', 'true');
    expect((await box('Son 30 gün')).getByRole('button', { name: 'Son 30 gün dövrünü seç' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const panel = detail('Son 30 gün');
    await waitFor(() =>
      expect(mocks.api.reports.runs).toHaveBeenCalledWith({
        from: '2026-10-06',
        to: TODAY,
        bucket: 'overdue',
      }),
    );
    expect(
      panel.getByRole('group', { name: 'Yoxlamalar' }).querySelector('[aria-pressed="true"]'),
    ).toHaveTextContent('Gecikmiş');

    await userEvent.click((await box('Bu gün')).getByRole('button', { name: 'Problemli: 2' }));
    await waitFor(() =>
      expect(mocks.api.reports.runs).toHaveBeenCalledWith({ from: TODAY, to: TODAY, bucket: 'problems' }),
    );
    expect((await box('Bu gün')).getByRole('button', { name: 'Problemli: 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(late).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(
      within(detail('Bu gün').getByRole('group', { name: 'Yoxlamalar' })).getByRole('button', {
        name: 'Tamamlanmış',
      }),
    );
    await waitFor(() =>
      expect(mocks.api.reports.runs).toHaveBeenCalledWith({ from: TODAY, to: TODAY, bucket: 'completed' }),
    );
    expect((await box('Bu gün')).getByRole('button', { name: 'Tamamlanan: 7' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it("resolves the periods from the tenant's today, not the browser's", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 01:30 on 5 November in Baku; 16:30 on 4 November in New York.
    vi.setSystemTime(new Date('2026-11-04T21:30:00Z'));
    renderWithRouter(<HomeDashboard />);
    await waitFor(() =>
      expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-10-30', to: '2026-11-05' }),
    );
    cleanup();
    mocks.api.reports.summary.mockClear();
    mocks.me.current = meWith(VIEWER, { timezone: 'America/New_York' });
    renderWithRouter(<HomeDashboard />);
    await waitFor(() =>
      expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-10-29', to: '2026-11-04' }),
    );
    expect(mocks.api.reports.summary).not.toHaveBeenCalledWith({ from: '2026-11-05', to: '2026-11-05' });
  });

  it('asks again every minute while the page is visible, not while it is hidden, and at once when it comes back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithRouter(<HomeDashboard today={TODAY} />, '/', appClient());
    await screen.findAllByRole('button', { name: 'Gecikən: 1' });
    expect(mocks.api.reports.summary).toHaveBeenCalledTimes(4);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    await waitFor(() => expect(mocks.api.reports.summary).toHaveBeenCalledTimes(8));

    act(() => focusManager.setFocused(false));
    await act(() => vi.advanceTimersByTimeAsync(180_000));
    expect(mocks.api.reports.summary).toHaveBeenCalledTimes(8);
    act(() => focusManager.setFocused(true));
    await waitFor(() => expect(mocks.api.reports.summary).toHaveBeenCalledTimes(12));
  });

  it('moves Today to the new day when the page stays open over midnight', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 23:59:30 in Baku.
    vi.setSystemTime(new Date('2026-11-04T19:59:30Z'));
    renderWithRouter(<HomeDashboard />, '/', appClient());
    await waitFor(() =>
      expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-11-04', to: '2026-11-04' }),
    );
    expect(mocks.api.reports.summary).not.toHaveBeenCalledWith({ from: '2026-11-05', to: '2026-11-05' });
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    await waitFor(() =>
      expect(mocks.api.reports.summary).toHaveBeenCalledWith({ from: '2026-11-05', to: '2026-11-05' }),
    );
  });

  it('refreshes every box on demand and says when the numbers were last updated', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 12:15 in Baku.
    vi.setSystemTime(new Date('2026-11-04T08:15:00Z'));
    renderWithRouter(<HomeDashboard today={TODAY} />);
    expect(await screen.findByText('Son yenilənmə: 12:15')).toBeInTheDocument();
    expect(mocks.api.reports.summary).toHaveBeenCalledTimes(4);
    vi.setSystemTime(new Date('2026-11-04T08:17:00Z'));
    await userEvent.click(screen.getByRole('button', { name: 'Yenilə' }));
    await waitFor(() => expect(mocks.api.reports.summary).toHaveBeenCalledTimes(8));
    expect(await screen.findByText('Son yenilənmə: 12:17')).toBeInTheDocument();
  });

  it('shows why a box could not be loaded', async () => {
    mocks.api.reports.summary.mockRejectedValue(new ApiError(503, 'REPORT_TIMEOUT', 'errors.REPORT_TIMEOUT'));
    renderWithRouter(<HomeDashboard today={TODAY} />);
    // Four boxes and the selected period's panel.
    expect(
      await screen.findAllByText(
        'Hesabat vaxtında hazırlanmadı. Dövrü qısaldın və ya bir az sonra yenidən cəhd edin.',
      ),
    ).toHaveLength(5);
  });
});
