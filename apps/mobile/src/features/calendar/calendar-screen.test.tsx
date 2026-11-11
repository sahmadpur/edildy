import { fireEvent, screen, within } from '@testing-library/react-native';
import type { OccurrenceDto } from '@edildy/contracts';
import { formatLocalDate } from '@edildy/i18n';
import { renderTeam } from '@/features/team/testing/render';
import { OCC, OCC2, OCC3, occurrence, OTHER, OTHER_EXECUTION, syncResponse, versionOf } from '@/offline/testing/fixtures';
import { createTestServices, type TestServices } from '@/offline/testing/test-services';
import { CalendarScreen } from './calendar-screen';

const mockPush = jest.fn();
const mockMine = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/session', () => ({
  useSession: () => ({ status: 'authenticated', offline: false, me: { user: { fullName: 'Aysel Əliyeva' } } }),
  api: { occurrences: { mine: (...a: unknown[]) => mockMine(...a) } },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

beforeEach(() => {
  mockPush.mockClear();
  mockMine.mockReset();
  mockMine.mockResolvedValue({ items: [], nextCursor: null });
});

/** Today is Monday 2 Nov 2026, 08:10 in Baku. OCC 08:00–11:00 open, OCC2 held by Murad, OCC3 18:00–21:00. */
async function world(online = false): Promise<TestServices> {
  const t = await createTestServices({ online });
  const claim = { executionId: OTHER_EXECUTION, executorUserId: OTHER, executorName: 'Murad Həsənov' };
  await t.seed(
    syncResponse({
      occurrences: [
        occurrence(),
        occurrence({ id: OCC2, checklistName: 'Kassa yoxlaması', status: 'started', claim }),
        occurrence({ id: OCC3, checklistName: 'Bağlanış yoxlaması', startsAt: '2026-11-02T14:00:00.000Z', dueAt: '2026-11-02T16:00:00.000Z', closesAt: '2026-11-02T17:00:00.000Z' }),
      ],
      checklistVersions: [versionOf(t.c.content)],
    }),
  );
  return t;
}

const remote = (over: Partial<OccurrenceDto>): OccurrenceDto => ({
  id: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e99',
  assignmentId: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e98',
  assignmentName: null,
  checklistId: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e30',
  checklistName: 'Anbar yoxlaması',
  siteId: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e40',
  siteName: 'Bakı filialı 1',
  shiftId: null,
  shiftName: null,
  localDate: '2026-10-20',
  startsAt: '2026-10-20T05:00:00.000Z',
  dueAt: '2026-10-20T06:00:00.000Z',
  closesAt: '2026-10-20T07:00:00.000Z',
  status: 'completed',
  statusChangedAt: '2026-10-20T05:40:00.000Z',
  cancelReason: null,
  assigneeIds: [],
  unassigned: false,
  executionBrief: { executionId: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e97', executorName: 'Aysel Əliyeva', state: 'completed', progress: { answered: 3, total: 3, requiredMissing: 0 }, scorePercent: 100, late: false, clockSuspect: false },
  ...over,
});

describe('Cədvəl', () => {
  it('opens on today’s hour grid with my runs as blocks and a now line', async () => {
    const t = await world();
    await renderTeam(t.services, <CalendarScreen />);
    expect(await screen.findByRole('header', { name: 'Cədvəl' })).toBeTruthy();
    expect(screen.getByTestId('calendar-label').props.children).toBe(formatLocalDate('2026-11-02', 'az', { weekday: true }));
    expect(await screen.findByTestId(`block-${OCC}`)).toBeTruthy();
    expect(screen.getByTestId(`block-${OCC3}`)).toBeTruthy();
    expect(screen.getByTestId('now-line')).toBeTruthy();
    // Offline in the test world: only the phone's runs, said once.
    expect(screen.getByTestId('calendar-offline')).toBeTruthy();
    expect(mockMine).not.toHaveBeenCalled();
    // A tap opens the run by its occurrence id, like Home; a run Murad holds does not open from here.
    await fireEvent.press(screen.getByTestId(`block-${OCC}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/execution/[id]', params: { id: OCC } });
    expect(screen.getByTestId(`block-${OCC2}`).props.accessibilityState?.disabled).toBe(true);
  });

  it('steps a day at a time and comes back with Bu gün', async () => {
    const t = await world();
    await renderTeam(t.services, <CalendarScreen />);
    await screen.findByTestId(`block-${OCC}`);
    await fireEvent.press(screen.getByTestId('calendar-next'));
    expect(screen.getByTestId('calendar-label').props.children).toBe(formatLocalDate('2026-11-03', 'az', { weekday: true }));
    expect(screen.queryByTestId(`block-${OCC}`)).toBeNull();
    expect(screen.queryByTestId('now-line')).toBeNull();
    await fireEvent.press(screen.getByTestId('calendar-today'));
    expect(screen.getByTestId(`block-${OCC}`)).toBeTruthy();
  });

  it('shows three day columns, then a month with the chosen day’s agenda', async () => {
    const t = await world();
    await renderTeam(t.services, <CalendarScreen />);
    await screen.findByTestId(`block-${OCC}`);
    await fireEvent.press(screen.getByRole('radio', { name: '3 gün' }));
    for (const d of ['2026-11-02', '2026-11-03', '2026-11-04']) expect(screen.getByTestId(`grid-day-${d}`)).toBeTruthy();
    expect(within(screen.getByTestId('grid-head-2026-11-03')).getByText('Ç.a.')).toBeTruthy();
    expect(screen.getByTestId('calendar-label').props.children).toBe('2 Noy – 4 Noy');

    await fireEvent.press(screen.getByRole('radio', { name: 'Ay' }));
    expect(screen.getByTestId('calendar-label').props.children).toBe('Noyabr 2026');
    const agenda = within(screen.getByTestId('agenda'));
    expect(agenda.getByText('Açılış yoxlaması')).toBeTruthy();
    expect(agenda.getByText('Bağlanış yoxlaması')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`agenda-${OCC3}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/execution/[id]', params: { id: OCC3 } });
    await fireEvent.press(screen.getByTestId('month-day-2026-11-05'));
    expect(within(screen.getByTestId('agenda')).getByText('Bu tarixdə yoxlama yoxdur.')).toBeTruthy();
  });

  it('online, fills older months from the server and opens those runs on their archive page', async () => {
    const t = await world(true);
    const old = remote({});
    const colleagues = remote({ id: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e96', checklistName: 'Kassa yoxlaması', startsAt: '2026-10-20T10:00:00.000Z', executionBrief: { ...old.executionBrief!, executionId: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e95', executorName: 'Kamran Rzayev' } });
    mockMine.mockImplementation(async (q: { from: string; to: string }) => ({ items: q.from <= old.localDate && old.localDate <= q.to ? [old, colleagues] : [], nextCursor: null }));
    await renderTeam(t.services, <CalendarScreen />);
    await screen.findByTestId(`block-${OCC}`);
    expect(screen.queryByTestId('calendar-offline')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Ay' }));
    await fireEvent.press(screen.getByTestId('calendar-prev'));
    expect(screen.getByTestId('calendar-label').props.children).toBe('Oktyabr 2026');
    // October 2026 in whole weeks (from Mon 28 Sep), and the evening before for a night run.
    expect(mockMine).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-09-27', to: '2026-11-01' }));
    await fireEvent.press(screen.getByTestId('month-day-2026-10-20'));
    await fireEvent.press(await screen.findByTestId(`agenda-${old.id}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/archive/[id]', params: { id: old.executionBrief!.executionId } });
    // Assigned to me but done by a colleague: listed with their name, not opened (the API keeps their run from me).
    const theirs = within(screen.getByTestId(`agenda-${colleagues.id}`));
    expect(theirs.getByText('İcra edən: Kamran Rzayev')).toBeTruthy();
    expect(screen.getByTestId(`agenda-${colleagues.id}`).props.accessibilityState?.disabled).toBe(true);
  });
});
