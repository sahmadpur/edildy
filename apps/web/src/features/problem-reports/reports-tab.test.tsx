import { az } from '@taskop/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/router';
import { assigneeOptions, taskDetail } from '@/features/tasks/fixtures';
import { problemReportDto } from './fixtures';
import { ReportsTab } from './reports-tab';
import { tickOptions } from '@/test/multi-select';

const mocks = vi.hoisted(() => ({
  canManageTasks: { current: true },
  api: {
    problemReports: { list: vi.fn(), close: vi.fn(), get: vi.fn() },
    sites: { list: vi.fn() },
    tasks: { create: vi.fn(), assignees: vi.fn() },
  },
}));
vi.mock('@/lib/session', () => ({
  api: mocks.api,
  useCan: (...keys: string[]) => keys.every((k) => k !== 'tasks.manage' || mocks.canManageTasks.current),
  useMe: () => ({ user: { id: 'mgr' }, permissions: ['tasks.manage'], tenant: { timezone: 'Asia/Baku', locale: 'az' } }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.canManageTasks.current = true;
  mocks.api.sites.list.mockResolvedValue([{ id: 'site1', name: 'Anbar №1' }, { id: 'site2', name: 'Filial 2' }]);
  mocks.api.tasks.assignees.mockResolvedValue(assigneeOptions());
  mocks.api.tasks.create.mockImplementation(async (body: { id: string }) => taskDetail({ id: body.id, problemReportId: 'r1' }));
  mocks.api.problemReports.list.mockResolvedValue({
    items: [problemReportDto(), problemReportDto({ id: 'r2', severity: 'normal', text: 'Lampa yanmır', location: null, media: [], state: 'closed', closedAt: REPORT_CLOSED, closedBy: { id: 'mgr', fullName: 'Leyla' }, closeComment: 'Dəyişdirildi' })],
    nextCursor: null,
  });
});
const REPORT_CLOSED = '2026-11-02T06:00:00.000Z';

describe('ReportsTab (2026-11-06 design §8)', () => {
  it('a deep link to a closed report switches the state filter to closed and highlights the row', async () => {
    const closed = problemReportDto({ id: 'r9', text: 'Köhnə problem', state: 'closed', closedAt: REPORT_CLOSED, closedBy: { id: 'mgr', fullName: 'Leyla' }, closeComment: 'Dəyişdirildi' });
    mocks.api.problemReports.get.mockResolvedValue(closed);
    mocks.api.problemReports.list.mockImplementation(async (q: { state: string }) => ({ items: q.state === 'closed' ? [closed] : [problemReportDto()], nextCursor: null }));
    renderWithRouter(<ReportsTab highlight="r9" />, '/problems?tab=reports&report=r9');
    const row = (await screen.findByText('Köhnə problem')).closest('tr')!;
    expect(row).toHaveAttribute('data-highlight', 'true');
    expect(screen.getByLabelText(az.executions.reportsTab.state)).toHaveValue('closed');
    expect(mocks.api.problemReports.get).toHaveBeenCalledWith('r9');
  });

  it('lists reports with their state, a map link, and a dash without a location; the default filter is active', async () => {
    renderWithRouter(<ReportsTab />, '/problems');
    await screen.findByText('Anbarın qapısı bağlanmır, kilid sınıb');
    expect(mocks.api.problemReports.list).toHaveBeenCalledWith(expect.objectContaining({ state: 'active', limit: 50 }));
    const [, first, second] = screen.getAllByRole('row');
    for (const text of ['Anbar №1', 'Fərid Hacıyev', 'Kritik', '1 fayl', 'Açıq']) expect(first).toHaveTextContent(text);
    expect(within(first!).getByRole('link', { name: 'Xəritə' })).toHaveAttribute('href', 'https://www.google.com/maps?q=40.4093,49.8671');
    expect(within(second!).queryByRole('link', { name: 'Xəritə' })).not.toBeInTheDocument();
    expect(second).toHaveTextContent('Bağlanıb');
    expect(within(second!).queryByRole('button', { name: 'Tapşırıq yarat' })).not.toBeInTheDocument();
    expect(within(first!).getByRole('button', { name: 'Tapşırıq yarat' })).toBeEnabled();
    expect(within(first!).getByRole('button', { name: 'Bağla' })).toBeEnabled();
  });

  it('filters by state and site', async () => {
    renderWithRouter(<ReportsTab />, '/problems');
    await screen.findByText('Lampa yanmır');
    await userEvent.selectOptions(await screen.findByLabelText(az.executions.reportsTab.state), 'closed');
    await waitFor(() => expect(mocks.api.sites.list).toHaveBeenCalled());
    await tickOptions(az.executions.reportsTab.site, ['Filial 2']);
    await waitFor(() => expect(mocks.api.problemReports.list).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'closed', siteId: 'site2' })));
  });

  it('hides the actions without tasks.manage', async () => {
    mocks.canManageTasks.current = false;
    renderWithRouter(<ReportsTab />, '/problems');
    await screen.findByText('Lampa yanmır');
    expect(screen.queryByRole('button', { name: 'Tapşırıq yarat' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bağla' })).not.toBeInTheDocument();
  });

  it('Tapşırıq yarat opens the task dialog pre-filled from the report with its site fixed, and sends problemReportId', async () => {
    renderWithRouter(<ReportsTab />, '/problems');
    await screen.findByText('Lampa yanmır');
    await userEvent.click(screen.getByRole('button', { name: 'Tapşırıq yarat' }));
    const dialog = await screen.findByRole('dialog', { name: az.tasks.dialog.fromReport });
    expect(within(dialog).getByLabelText('Başlıq')).toHaveValue('Anbarın qapısı bağlanmır, kilid sınıb');
    expect(within(dialog).getByLabelText('Təlimat')).toHaveValue('Anbarın qapısı bağlanmır, kilid sınıb');
    expect(within(dialog).getByLabelText('Prioritet')).toHaveValue('high');
    expect(within(dialog).getByText(az.tasks.dialog.siteFromProblem.replace('{{site}}', 'Anbar №1'))).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Obyekt')).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'İcraçı' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Nigar Səfərli' }, { timeout: 3000 }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yarat' }));
    await waitFor(() => expect(mocks.api.tasks.create).toHaveBeenCalled());
    expect(mocks.api.tasks.create.mock.calls[0]![0]).toMatchObject({ problemReportId: 'r1', problemId: null, siteId: null, requiresReview: true, priority: 'high', assignee: { userId: 'w1' } });
  });

  it('Bağla asks for a comment, posts it and refreshes the list', async () => {
    mocks.api.problemReports.close.mockResolvedValue(problemReportDto({ state: 'closed', closedAt: REPORT_CLOSED, closedBy: { id: 'mgr', fullName: 'Leyla' }, closeComment: 'Yerində düzəldildi' }));
    renderWithRouter(<ReportsTab />, '/problems');
    await screen.findByText('Lampa yanmır');
    await userEvent.click(screen.getByRole('button', { name: 'Bağla' }));
    const dialog = await screen.findByRole('dialog', { name: az.executions.reportsTab.closeTitle });
    await userEvent.click(within(dialog).getByRole('button', { name: az.executions.reportsTab.closeSave }));
    expect(await within(dialog).findByText(az.errors.validation.required)).toBeInTheDocument();
    expect(mocks.api.problemReports.close).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByLabelText(az.executions.reportsTab.closeComment));
    await userEvent.paste('Yerində düzəldildi');
    await userEvent.click(within(dialog).getByRole('button', { name: az.executions.reportsTab.closeSave }));
    await waitFor(() => expect(mocks.api.problemReports.close).toHaveBeenCalledWith('r1', { comment: 'Yerində düzəldildi' }));
    await waitFor(() => expect(mocks.api.problemReports.list).toHaveBeenCalledTimes(2));
  });
});
