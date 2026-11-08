import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/router';
import { AssignmentsRoute, RosterRoute, ScheduleRoute, ShiftsRoute } from './routes';

const mocks = vi.hoisted(() => ({
  api: {
    assignments: { list: vi.fn() },
    occurrences: { list: vi.fn() },
    shifts: { list: vi.fn() },
    roster: { get: vi.fn() },
    sites: { list: vi.fn() },
  },
}));
vi.mock('@/lib/session', () => ({
  api: mocks.api,
  useCan: () => true,
  useMe: () => ({ tenant: { timezone: 'Asia/Baku', locale: 'az' }, permissions: ['assignments.view', 'checklists.view', 'checklists.manage', 'shifts.view'] }),
}));

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.resetAllMocks();
  mocks.api.assignments.list.mockResolvedValue({ items: [], nextCursor: null });
  mocks.api.occurrences.list.mockResolvedValue({ items: [], nextCursor: null });
  mocks.api.shifts.list.mockResolvedValue([]);
  mocks.api.sites.list.mockResolvedValue([]);
});

describe('Yoxlamalar tabs', () => {
  it('shows the assignments list under the Təyinatlar tab of Yoxlamalar, beside checklists and templates', async () => {
    const router = renderWithRouter(<AssignmentsRoute />, '/assignments');
    expect(await screen.findByRole('heading', { level: 1, name: 'Yoxlamalar' })).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'Yoxlamalar' }));
    expect(tabs.getAllByRole('link').map((l) => l.textContent)).toEqual(['Təyinatlar', 'Yoxlama cədvəli', 'Yoxlama vərəqələri', 'Şablonlar']);
    expect(tabs.getByRole('link', { name: 'Təyinatlar' })).toHaveAttribute('aria-current', 'page');
    const checklists = tabs.getByRole('link', { name: 'Yoxlama vərəqələri' });
    expect(checklists).toHaveAttribute('href', '/checklists');
    await userEvent.click(checklists);
    await waitFor(() => expect(router.state.location.pathname).toBe('/checklists'));
  });

  it('shows the schedule (reached from run links) under the Yoxlamalar heading with Təyinatlar current', async () => {
    renderWithRouter(<ScheduleRoute />, '/schedule?date=2026-11-04');
    expect(await screen.findByRole('heading', { level: 1, name: 'Yoxlamalar' })).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'Yoxlamalar' }));
    expect(tabs.queryByRole('link', { name: 'İcra cədvəli' })).not.toBeInTheDocument();
    expect(tabs.getByRole('link', { name: 'Təyinatlar' })).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(mocks.api.occurrences.list).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-11-02', to: '2026-11-08' })));
  });
});

describe('Növbələr tabs', () => {
  it('shows shifts under the Növbələr tab with the roster one click away', async () => {
    const router = renderWithRouter(<ShiftsRoute />, '/shifts');
    expect(await screen.findByRole('heading', { level: 1, name: 'Növbələr' })).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'Növbələr' }));
    expect(tabs.getByRole('link', { name: 'Növbələr' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(tabs.getByRole('link', { name: 'Növbə cədvəli' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/roster'));
  });

  it('shows the roster under the Növbələr heading with its own tab current', async () => {
    renderWithRouter(<RosterRoute />, '/roster');
    expect(await screen.findByRole('heading', { level: 1, name: 'Növbələr' })).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'Növbələr' }));
    expect(tabs.getByRole('link', { name: 'Növbə cədvəli' })).toHaveAttribute('aria-current', 'page');
    expect(tabs.getByRole('link', { name: 'Növbələr' })).toHaveAttribute('href', '/shifts');
  });
});
