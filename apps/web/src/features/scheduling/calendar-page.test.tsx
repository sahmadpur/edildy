import type { CalendarItem } from '@taskop/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/router';
import { CalendarRoute } from './routes';

const mocks = vi.hoisted(() => ({
  api: {
    occurrences: { calendar: vi.fn(), get: vi.fn() },
    checklists: { list: vi.fn() },
    users: { list: vi.fn() },
    sites: { list: vi.fn() },
  },
}));
vi.mock('@/lib/session', () => ({
  api: mocks.api,
  useCan: () => true,
  useMe: () => ({ tenant: { timezone: 'Asia/Baku', locale: 'az' }, permissions: ['assignments.view', 'checklists.view', 'checklists.manage'] }),
}));

const item = (over: Partial<CalendarItem> = {}): CalendarItem => ({
  kind: 'run',
  occurrenceId: 'o1',
  assignmentId: 'a1',
  assignmentName: null,
  checklistId: 'c1',
  checklistName: 'Açılış yoxlaması',
  siteId: 's1',
  siteName: 'Anbar №1',
  shiftName: null,
  localDate: '2026-11-10',
  startsAt: '2026-11-10T04:00:00.000Z',
  dueAt: '2026-11-10T06:00:00.000Z',
  status: 'pending',
  assigneeNames: ['Nigar Səfərli'],
  executionBrief: null,
  ...over,
});

const hourly = (h: number): CalendarItem =>
  item({
    occurrenceId: `t${h}`,
    assignmentId: 'a2',
    checklistName: 'Tualet yoxlaması',
    startsAt: `2026-11-10T${String(h - 4).padStart(2, '0')}:00:00.000Z`,
    dueAt: `2026-11-10T${String(h - 3).padStart(2, '0')}:00:00.000Z`,
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-08T08:00:00Z') });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.resetAllMocks();
  mocks.api.checklists.list.mockResolvedValue({ items: [], nextCursor: null });
  mocks.api.users.list.mockResolvedValue({ items: [], nextCursor: null });
  mocks.api.sites.list.mockResolvedValue([]);
  mocks.api.occurrences.calendar.mockResolvedValue({
    items: [item(), hourly(9), hourly(10), hourly(11), item({ kind: 'planned', occurrenceId: null, status: 'planned', localDate: '2026-11-25', startsAt: '2026-11-25T04:00:00.000Z' })],
    truncated: false,
  });
});

describe('Yoxlama cədvəli', () => {
  it('is a Yoxlamalar tab with a six-week month grid, runs, collapsed repeats and planned checks', async () => {
    renderWithRouter(<CalendarRoute />, '/calendar');
    const tabs = within(await screen.findByRole('navigation', { name: 'Yoxlamalar' }));
    expect(tabs.getByRole('link', { name: 'Yoxlama cədvəli' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'Noyabr 2026' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.api.occurrences.calendar).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-10-26', to: '2026-12-06' })));
    const day = within(await screen.findByRole('gridcell', { name: '10 Noy 2026' }));
    expect(await day.findByRole('button', { name: /08:00\s*Açılış yoxlaması/ })).toBeInTheDocument();
    // Three hourly runs of one assignment are one chip.
    expect(day.getByRole('button', { name: /Tualet yoxlaması\s*3 dəfə/ })).toBeInTheDocument();
    expect(within(screen.getByRole('gridcell', { name: '25 Noy 2026' })).getByRole('button', { name: /Açılış yoxlaması/ })).toBeInTheDocument();
  });

  it('moves by month and sends the filters', async () => {
    renderWithRouter(<CalendarRoute />, '/calendar');
    await screen.findByRole('gridcell', { name: '10 Noy 2026' });
    await userEvent.click(screen.getByRole('button', { name: 'Növbəti ay' }));
    expect(screen.getByRole('heading', { name: 'Dekabr 2026' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.api.occurrences.calendar).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-11-30', to: '2027-01-10' })));
  });
});
