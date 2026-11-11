import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatLocalDate } from '@/features/scheduling/labels';
import { filterOptions, tickOptions } from '@/test/multi-select';
import { renderWithProviders } from '@/test/render';
import { CHECKLISTS, EMPLOYEE_ROWS, IDS, meWith, SITES, TODAY, VIEWER } from './fixtures';
import { ReportFilters } from './report-filters';
import type { ReportSearch } from './search';

const mocks = vi.hoisted(() => ({
  me: { current: null as unknown },
  api: { reports: { employees: vi.fn() }, sites: { list: vi.fn() }, checklists: { list: vi.fn() } },
}));
vi.mock('@/lib/session', () => ({
  api: mocks.api,
  useMe: () => mocks.me.current,
  useCan: (...keys: string[]) =>
    keys.every((k) => (mocks.me.current as { permissions: string[] }).permissions.includes(k)),
}));

/** The bar keeps no state of its own: the harness plays the page that stores it in the URL. */
function Harness({ initial, onChange }: { initial: ReportSearch; onChange: (next: ReportSearch) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <ReportFilters
      value={value}
      today={TODAY}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

function renderBar(initial: ReportSearch = {}) {
  const onChange = vi.fn();
  renderWithProviders(<Harness initial={initial} onChange={onChange} />);
  return onChange;
}

const texts = (select: HTMLElement): (string | null)[] =>
  within(select)
    .getAllByRole('option')
    .map((o) => o.textContent);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.me.current = meWith(VIEWER);
  mocks.api.sites.list.mockResolvedValue(SITES);
  mocks.api.checklists.list.mockResolvedValue({ items: CHECKLISTS, nextCursor: null });
  mocks.api.reports.employees.mockResolvedValue(EMPLOYEE_ROWS);
});

describe('ReportFilters', () => {
  it('switches between presets and a custom range pre-filled from the current period', async () => {
    const onChange = renderBar({ period: 'this_week', siteId: IDS.zoneA });
    const period = screen.getByLabelText('Dövr');
    expect(texts(period)).toEqual([
      'Bu gün',
      'Dünən',
      'Bu həftə',
      'Bu ay',
      'Son 7 gün',
      'Son 30 gün',
      'Seçilmiş dövr',
    ]);
    expect(
      screen.getByText(`${formatLocalDate('2026-11-02')} – ${formatLocalDate(TODAY)}`),
    ).toBeInTheDocument();

    await userEvent.selectOptions(period, 'custom');
    expect(onChange).toHaveBeenLastCalledWith({
      period: 'custom',
      from: '2026-11-02',
      to: TODAY,
      siteId: IDS.zoneA,
    });
    expect(screen.getByLabelText('Başlama')).toHaveValue('2026-11-02');
    fireEvent.change(screen.getByLabelText('Başlama'), { target: { value: '2026-10-01' } });
    expect(onChange).toHaveBeenLastCalledWith({
      period: 'custom',
      from: '2026-10-01',
      to: TODAY,
      siteId: IDS.zoneA,
    });

    await userEvent.selectOptions(period, 'last_30');
    expect(onChange).toHaveBeenLastCalledWith({ siteId: IDS.zoneA });
    expect(screen.queryByLabelText('Başlama')).not.toBeInTheDocument();
  });

  it('defaults to the last 30 days: that period is dropped from the search, today is written explicitly', async () => {
    const onChange = renderBar({ siteId: IDS.zoneA });
    expect(screen.getByLabelText('Dövr')).toHaveValue('last_30');
    await userEvent.selectOptions(screen.getByLabelText('Dövr'), 'today');
    expect(onChange).toHaveBeenLastCalledWith({ period: 'today', siteId: IDS.zoneA });
    expect(screen.getByLabelText('Dövr')).toHaveValue('today');
  });

  it('explains an inverted, too long or incomplete custom range and asks for nothing', () => {
    renderBar({ period: 'custom', from: '2026-10-31', to: '2026-10-01' });
    expect(screen.getByRole('alert')).toHaveTextContent('Son tarix başlanğıc tarixindən əvvəl ola bilməz.');
    cleanup();
    renderBar({ period: 'custom', from: '2025-01-01', to: TODAY });
    expect(screen.getByRole('alert')).toHaveTextContent('Hesabat dövrü ən çox 366 gün ola bilər.');
    cleanup();
    renderBar({ period: 'custom', from: TODAY });
    expect(screen.getByRole('alert')).toHaveTextContent('Başlanğıc və son tarixi seçin.');
    expect(mocks.api.reports.employees).not.toHaveBeenCalled();
  });

  it('lists sites as a tree and checklists from every page, inactive ones only after "show inactive"', async () => {
    mocks.api.checklists.list
      .mockResolvedValueOnce({ items: [CHECKLISTS[0]], nextCursor: IDS.checklist })
      .mockResolvedValueOnce({ items: [CHECKLISTS[1]], nextCursor: null });
    const onChange = renderBar();
    await waitFor(() => expect(mocks.api.checklists.list).toHaveBeenCalledTimes(2));
    await waitFor(async () => expect(await filterOptions('Obyekt')).toEqual(['Bütün obyektlər', 'Filial A', '\u00a0\u00a0Zona A1']));
    expect(await filterOptions('Yoxlama vərəqəsi')).toEqual(['Bütün yoxlama vərəqələri', 'Açılış yoxlaması']);
    expect(mocks.api.checklists.list).toHaveBeenNthCalledWith(1, { limit: 200 });
    expect(mocks.api.checklists.list).toHaveBeenNthCalledWith(2, { limit: 200, cursor: IDS.checklist });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Deaktivləri göstər' }));
    expect(onChange).toHaveBeenLastCalledWith({ inactive: true });
    expect(await filterOptions('Obyekt')).toEqual([
      'Bütün obyektlər',
      'Filial A',
      '\u00a0\u00a0Zona A1',
      '\u00a0\u00a0Zona B (köhnə) (Deaktiv)',
    ]);
    expect(await filterOptions('Yoxlama vərəqəsi')).toEqual([
      'Bütün yoxlama vərəqələri',
      'Açılış yoxlaması',
      'Köhnə yoxlama (Deaktiv)',
    ]);

    // Multi-select (feedback 2026-11-07): several sites go to the URL as a comma list; "all" clears it.
    await tickOptions('Obyekt', [/Zona A1/]);
    expect(onChange).toHaveBeenLastCalledWith({ inactive: true, siteId: IDS.zoneA });
    await tickOptions('Obyekt', ['Filial A']);
    expect(onChange).toHaveBeenLastCalledWith({ inactive: true, siteId: `${IDS.zoneA},${IDS.branch}` });
    expect(screen.getByRole('button', { name: 'Obyekt' })).toHaveTextContent('Filial A +1');
    await tickOptions('Obyekt', ['Bütün obyektlər']);
    expect(onChange).toHaveBeenLastCalledWith({ inactive: true });
  });

  it('fills the employee picker from the period’s employee report, without its own filter or the Unassigned row', async () => {
    const onChange = renderBar({ period: 'yesterday', userId: IDS.aynur, siteId: IDS.zoneA });
    await waitFor(() =>
      expect(mocks.api.reports.employees).toHaveBeenCalledWith({
        from: '2026-11-03',
        to: '2026-11-03',
        siteId: IDS.zoneA,
      }),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Əməkdaş' })).toHaveTextContent('Aynur Quliyeva'));
    expect(await filterOptions('Əməkdaş')).toEqual(['Bütün əməkdaşlar', 'Aynur Quliyeva', 'Kamran Əliyev']);
    await tickOptions('Əməkdaş', ['Kamran Əliyev']);
    // Both people ticked is every option: the same as "all".
    expect(onChange).toHaveBeenLastCalledWith({ period: 'yesterday', siteId: IDS.zoneA });
  });

  it('keeps a selected inactive or unlisted site, employee and checklist visible', async () => {
    renderBar({ siteId: IDS.zoneB, userId: IDS.rauf, checklistId: IDS.oldChecklist });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Obyekt' })).toHaveTextContent('Zona B (köhnə) (Deaktiv)'),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Əməkdaş' })).toHaveTextContent('Rauf Həsənov (Deaktiv)'),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Yoxlama vərəqəsi' })).toHaveTextContent('Köhnə yoxlama (Deaktiv)'),
    );
    cleanup();
    // A person with no runs in the period is not in the report, but the filter still applies.
    renderBar({ userId: IDS.stranger });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Əməkdaş' })).toHaveTextContent(
        'Seçilmiş əməkdaş (bu dövrdə yoxlaması yoxdur)',
      ),
    );
  });

  it('never reads as "all" while the site list is loading or failed: the selected id shows as unlisted', async () => {
    mocks.api.sites.list.mockRejectedValue(new Error('boom'));
    renderBar({ siteId: IDS.zoneA });
    expect(screen.getByRole('button', { name: 'Obyekt' })).toHaveTextContent('Seçilmiş (siyahıda yoxdur)');
    await waitFor(() => expect(mocks.api.sites.list).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Obyekt' })).toHaveTextContent('Seçilmiş (siyahıda yoxdur)');
  });

  it('keeps the selected person visible when an invalid custom range asks for no employee report', () => {
    // An invalid custom range asks for no employee report, yet the selected person stays visible.
    renderBar({ period: 'custom', from: '2026-10-31', to: '2026-10-01', userId: IDS.aynur });
    expect(screen.getByRole('button', { name: 'Əməkdaş' })).toHaveTextContent('Seçilmiş əməkdaş (bu dövrdə yoxlaması yoxdur)');
    expect(mocks.api.reports.employees).not.toHaveBeenCalled();
  });

  it('shows a checklist id the list does not contain as selected', async () => {
    renderBar({ checklistId: IDS.stranger });
    await waitFor(() => expect(mocks.api.checklists.list).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Yoxlama vərəqəsi' })).toHaveTextContent('Seçilmiş (siyahıda yoxdur)'),
    );
  });

  it('hides the site and checklist pickers without sites.view or checklists.view and does not ask for them', async () => {
    mocks.me.current = meWith(['reports.view']);
    renderBar();
    expect(await screen.findByLabelText('Əməkdaş')).toBeInTheDocument();
    expect(screen.queryByLabelText('Obyekt')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Yoxlama vərəqəsi')).not.toBeInTheDocument();
    expect(mocks.api.sites.list).not.toHaveBeenCalled();
    expect(mocks.api.checklists.list).not.toHaveBeenCalled();
  });
});
