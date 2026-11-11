import type { ShiftDto } from '@edildy/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ShiftsPage } from './shifts-page';

const mocks = vi.hoisted(() => ({
  api: { shifts: { list: vi.fn(), create: vi.fn(), update: vi.fn() }, sites: { list: vi.fn() } },
}));
vi.mock('@/lib/session', () => ({
  useFeature: () => true,
  useFeatureOrStaff: () => true, api: mocks.api, useCan: () => true }));

const shift = (over: Partial<ShiftDto> = {}): ShiftDto => ({
  id: 's1', name: 'Səhər', ranges: [{ startTime: '08:00', endTime: '16:00' }], siteId: null, siteName: null, active: true, ...over,
});

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.resetAllMocks();
  mocks.api.sites.list.mockResolvedValue([{ id: 'site1', name: 'Anbar', parentId: null, typeId: 't', address: null, active: true, path: 'x', depth: 0 }]);
});

describe('ShiftsPage', () => {
  it('lists shifts and marks the ones that end the next day', async () => {
    mocks.api.shifts.list.mockResolvedValue([shift(), shift({ id: 's2', name: 'Gecə', ranges: [{ startTime: '22:00', endTime: '06:00' }], siteId: 'site1', siteName: 'Anbar' })]);
    renderWithProviders(<ShiftsPage />);
    expect(await screen.findByText('08:00–16:00')).toBeInTheDocument();
    expect(screen.getByText('22:00–06:00 (növbəti gün bitir)')).toBeInTheDocument();
    expect(screen.getByText('Bütün obyektlər')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Anbar' })).toBeInTheDocument();
  });

  it('creates a shift for one site', async () => {
    mocks.api.shifts.list.mockResolvedValue([]);
    mocks.api.shifts.create.mockResolvedValue(shift());
    renderWithProviders(<ShiftsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Yeni növbə' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Ad'), 'Gecə');
    fireEvent.change(within(dialog).getByLabelText('Başlama'), { target: { value: '22:00' } });
    fireEvent.change(within(dialog).getByLabelText('Bitmə'), { target: { value: '06:00' } });
    expect(within(dialog).getByText('növbəti gün bitir')).toBeInTheDocument();
    await within(dialog).findByRole('option', { name: 'Anbar' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Obyekt'), 'site1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yadda saxla' }));
    await waitFor(() => expect(mocks.api.shifts.create).toHaveBeenCalledWith({ name: 'Gecə', ranges: [{ startTime: '22:00', endTime: '06:00' }], siteId: 'site1' }));
  });

  it('creates a shift with a morning and an evening period (feedback 2026-11-11, item 12)', async () => {
    mocks.api.shifts.list.mockResolvedValue([]);
    mocks.api.shifts.create.mockResolvedValue(shift());
    renderWithProviders(<ShiftsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Yeni növbə' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Ad'), 'Bölünmüş');
    const first = within(within(dialog).getByRole('group', { name: 'Aralıq 1' }));
    fireEvent.change(first.getByLabelText('Bitmə'), { target: { value: '10:00' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Saat aralığı əlavə et' }));
    const second = within(within(dialog).getByRole('group', { name: 'Aralıq 2' }));
    fireEvent.change(second.getByLabelText('Başlama'), { target: { value: '09:00' } });
    fireEvent.change(second.getByLabelText('Bitmə'), { target: { value: '11:00' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yadda saxla' }));
    expect(await within(dialog).findByText('Növbənin saat aralıqları bir-birini kəsməməlidir.')).toBeInTheDocument();
    fireEvent.change(second.getByLabelText('Başlama'), { target: { value: '18:00' } });
    fireEvent.change(second.getByLabelText('Bitmə'), { target: { value: '20:00' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yadda saxla' }));
    await waitFor(() =>
      expect(mocks.api.shifts.create).toHaveBeenCalledWith({
        name: 'Bölünmüş',
        ranges: [
          { startTime: '08:00', endTime: '10:00' },
          { startTime: '18:00', endTime: '20:00' },
        ],
        siteId: null,
      }),
    );
  });

  it('rejects a zero-length shift before calling the API', async () => {
    mocks.api.shifts.list.mockResolvedValue([]);
    renderWithProviders(<ShiftsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Yeni növbə' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Ad'), 'X');
    fireEvent.change(within(dialog).getByLabelText('Bitmə'), { target: { value: '08:00' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yadda saxla' }));
    expect(await within(dialog).findByText('Növbənin başlama və bitmə vaxtı eyni ola bilməz.')).toBeInTheDocument();
    expect(mocks.api.shifts.create).not.toHaveBeenCalled();
  });

  it('deactivates a shift', async () => {
    mocks.api.shifts.list.mockResolvedValue([shift()]);
    mocks.api.shifts.update.mockResolvedValue(shift({ active: false }));
    renderWithProviders(<ShiftsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ləğv et' }));
    expect(screen.getByText('«Səhər» növbəsi ləğv edilsin? Mövcud təyinatlar dəyişməyəcək.')).toBeInTheDocument();
    expect(mocks.api.shifts.update).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Təsdiqlə' }));
    await waitFor(() => expect(mocks.api.shifts.update).toHaveBeenCalledWith('s1', { active: false }));
  });

  it('keeps a shift’s site that is not among the options when editing', async () => {
    mocks.api.shifts.list.mockResolvedValue([shift({ siteId: 'old', siteName: 'Köhnə filial' })]);
    mocks.api.shifts.update.mockResolvedValue(shift());
    renderWithProviders(<ShiftsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Düzəliş et' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Anbar' });
    expect(within(dialog).getByLabelText('Obyekt')).toHaveValue('old');
    await userEvent.clear(within(dialog).getByLabelText('Ad'));
    await userEvent.type(within(dialog).getByLabelText('Ad'), 'Səhər 2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yadda saxla' }));
    await waitFor(() => expect(mocks.api.shifts.update).toHaveBeenCalledWith('s1', { name: 'Səhər 2', ranges: [{ startTime: '08:00', endTime: '16:00' }] }));
  });

  it('sends the site when it was changed', async () => {
    mocks.api.shifts.list.mockResolvedValue([shift({ siteId: 'old', siteName: 'Köhnə filial' })]);
    mocks.api.shifts.update.mockResolvedValue(shift());
    renderWithProviders(<ShiftsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Düzəliş et' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Anbar' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Obyekt'), '');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yadda saxla' }));
    await waitFor(() => expect(mocks.api.shifts.update).toHaveBeenCalledWith('s1', { name: 'Səhər', ranges: [{ startTime: '08:00', endTime: '16:00' }], siteId: null }));
  });
});
