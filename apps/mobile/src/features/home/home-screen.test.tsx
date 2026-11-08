import { fireEvent, screen, within } from '@testing-library/react-native';
import { Alert, StyleSheet } from 'react-native';
import { formatDateTime } from '@taskop/i18n';
import i18n from '@/lib/i18n';
import { colors } from '@/lib/theme';
import { ME, OCC, OCC2, OCC3, OCC4, OCC5, occurrence, OTHER, OTHER_EXECUTION, REWORK_DUE, reworkSync, syncResponse, VERSION2, versionOf } from '@/offline/testing/fixtures';
import { eventually, renderWithServices } from '@/offline/testing/render';
import { createTestServices, type TestServices } from '@/offline/testing/test-services';
import { HomeScreen } from './home-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/session', () => ({
  useSession: () => ({ status: 'authenticated', offline: false, me: { user: { fullName: 'Aysel Əliyeva' } } }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

beforeEach(() => mockPush.mockClear());

/** OCC open, OCC2 claimed by Murad, OCC3 later today, OCC4 completed, OCC5 open (optionally on a too-new version). */
async function world(extra: { version?: string } = {}): Promise<TestServices> {
  const t = await createTestServices();
  const claim = { executionId: OTHER_EXECUTION, executorUserId: OTHER, executorName: 'Murad Həsənov' };
  await t.seed(
    syncResponse({
      occurrences: [
        occurrence(),
        occurrence({ id: OCC2, checklistName: 'Kassa yoxlaması', status: 'started', claim }),
        occurrence({ id: OCC3, checklistName: 'Bağlanış yoxlaması', startsAt: '2026-11-02T14:00:00.000Z', dueAt: '2026-11-02T16:00:00.000Z', closesAt: '2026-11-02T17:00:00.000Z' }),
        occurrence({ id: OCC4, checklistName: 'Anbar yoxlaması', status: 'completed' }),
        occurrence({ id: OCC5, checklistName: 'Mətbəx yoxlaması', ...(extra.version ? { checklistVersionId: extra.version } : {}) }),
      ],
      checklistVersions: [versionOf(t.c.content), versionOf({ schemaVersion: 2 }, VERSION2, 2)],
    }),
  );
  return t;
}

describe('My checklists', () => {
  it('shows the notification bell with the unread count next to the sync indicator', async () => {
    const t = await world();
    await t.services.setUnreadNotifications(2);
    await renderWithServices(t.services, <HomeScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Bildirişlər, 2 oxunmamış' }));
    expect(mockPush).toHaveBeenCalledWith('/notifications');
  });

  it('lists my open runs on top with no Tapşırıqlar box, then three boxes that each open their own list', async () => {
    const t = await world();
    await t.services.store.start(OCC, ME);
    t.clock.set('2026-11-02T06:30:00.000Z'); // 10:30 in Baku: past due, before close
    await renderWithServices(t.services, <HomeScreen />);
    // 8 Nov 2026: the Tapşırıqlar box is gone; its runs are always listed under "İndi" with the count.
    const now = within(await screen.findByTestId('section-myTasks'));
    expect(screen.queryByTestId('stat-myTasks')).toBeNull();
    expect(now.getByRole('header', { name: 'İndi' })).toBeTruthy();
    expect(now.getByText('2')).toBeTruthy();
    expect(within(screen.getByTestId('stat-overdue')).getByText('Gecikən')).toBeTruthy();
    expect(within(screen.getByTestId('stat-overdue')).getByText('2')).toBeTruthy();
    expect(within(screen.getByTestId('stat-completed')).getByText('Tamamlanan')).toBeTruthy();
    expect(within(screen.getByTestId('stat-completed')).getByText('1')).toBeTruthy();
    expect(within(screen.getByTestId('stat-upcoming')).getByText('Gələcək')).toBeTruthy();
    expect(within(screen.getByTestId('stat-upcoming')).getByText('1')).toBeTruthy();
    expect(screen.queryByTestId('stat-issues')).toBeNull();
    // The open list: my run in progress, the overdue open one, and the one Murad holds (listed, not counted).
    expect(now.getAllByTestId(/^occurrence-/)).toHaveLength(3);
    // No box list is open at first.
    expect(screen.queryByTestId('section-toggle-myTasks')).toBeNull();
    expect(screen.getByTestId('section-toggle-overdue').props.accessibilityState).toEqual({ expanded: false });
    expect(within(screen.getByTestId(`occurrence-${OCC}`)).getByRole('button', { name: 'Davam et: Açılış yoxlaması' })).toBeTruthy();
    expect(within(screen.getByTestId(`occurrence-${OCC5}`)).getByText('Gecikir')).toBeTruthy();
    expect(screen.getByText('Murad Həsənov icra edir')).toBeTruthy();
    expect(screen.queryByTestId(`occurrence-${OCC3}`)).toBeNull();
    // A box opens its list and folds the others (point 10); the open list on top stays.
    await fireEvent.press(screen.getByTestId('stat-overdue'));
    expect(within(screen.getByTestId('section-overdue')).getAllByTestId(/^occurrence-/)).toHaveLength(2);
    await fireEvent.press(screen.getByTestId('stat-upcoming'));
    expect(within(screen.getByTestId('section-overdue')).queryAllByTestId(/^occurrence-/)).toHaveLength(0);
    expect(within(screen.getByTestId('section-myTasks')).getAllByTestId(/^occurrence-/)).toHaveLength(3);
    const upcoming = within(screen.getByTestId(`occurrence-${OCC3}`));
    expect(upcoming.getByText(formatDateTime('2026-11-02T14:00:00.000Z', { locale: 'az', timeZone: 'Asia/Baku' }))).toBeTruthy();
    // An upcoming run opens read-only (point 12).
    await fireEvent.press(screen.getByTestId(`occurrence-${OCC3}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/execution/[id]', params: { id: OCC3 } });
    await fireEvent.press(screen.getByTestId('stat-completed'));
    expect(screen.getByTestId(`occurrence-${OCC4}`)).toBeTruthy();
    // A list's own heading folds it.
    await fireEvent.press(screen.getByTestId('section-toggle-completed'));
    expect(screen.queryByTestId(`occurrence-${OCC4}`)).toBeNull();
  });

  it('keeps the site name whole and lets a long checklist name shrink', async () => {
    const t = await createTestServices();
    await t.seed(
      syncResponse({
        occurrences: [occurrence({ checklistName: 'Çox uzun adı olan gündəlik təmizlik və təhlükəsizlik yoxlaması', siteName: 'Nərimanov filialı' })],
        checklistVersions: [versionOf(t.c.content)],
      }),
    );
    await renderWithServices(t.services, <HomeScreen />);
    const card = within(await screen.findByTestId(`occurrence-${OCC}`));
    const name = card.getByText(/Çox uzun adı/);
    expect(name.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(name.props.style).flexShrink).toBe(1);
    const site = card.getByText('Nərimanov filialı');
    expect(StyleSheet.flatten(site.props.style).flexShrink).toBe(0);
    // A very long site name must not squeeze the checklist name to nothing: the site column is capped and clipped.
    expect(site.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(card.getByTestId('site-column').props.style).maxWidth).toBe('55%');
  });

  it('greets by full name under a date-only eyebrow, with the sync dot and the bell, and no tasks box', async () => {
    const t = await world();
    t.clock.set('2026-11-06T06:00:00.000Z');
    await renderWithServices(t.services, <HomeScreen />);
    expect(await screen.findByRole('header', { name: 'Salam, Aysel Əliyeva!' })).toBeTruthy();
    expect(screen.getByText('6 Noy 2026')).toBeTruthy(); // no weekday; months are capitalised since PR #19
    expect(screen.queryByText('Bugünkü yoxlamalarınız')).toBeNull();
    expect(screen.queryByTestId('home-tasks')).toBeNull();
    expect(screen.getByTestId('sync-indicator-offline')).toBeTruthy(); // the test world is offline
    expect(screen.queryByText('Oflayn')).toBeNull(); // a dot, no words
  });

  it('starts an open checklist and opens it by its occurrence id', async () => {
    const t = await world();
    await renderWithServices(t.services, <HomeScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Başla: Mətbəx yoxlaması' }));
    await eventually(async () => expect(mockPush).toHaveBeenCalledWith({ pathname: '/execution/[id]', params: { id: OCC5 } }));
    const views = await t.services.store.occurrences();
    expect(views.find((o) => o.id === OCC5)!.execution).toMatchObject({ state: 'active', claim: 'pending' });
  });

  it('opens a started checklist by its occurrence id without starting it again', async () => {
    const t = await world();
    await t.services.store.start(OCC, ME);
    const start = jest.spyOn(t.services.store, 'start');
    await renderWithServices(t.services, <HomeScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Davam et: Açılış yoxlaması' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/execution/[id]', params: { id: OCC } });
    expect(start).not.toHaveBeenCalled();
  });

  it('explains why a start is refused', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const t = await world({ version: VERSION2 });
    await renderWithServices(t.services, <HomeScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Başla: Mətbəx yoxlaması' }));
    await eventually(async () => expect(alert).toHaveBeenCalledWith('Tətbiqi yeniləyin'));
    expect(mockPush).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('shows on the card why the server did not accept an execution', async () => {
    const t = await world();
    const id = await t.services.store.start(OCC, ME);
    await t.db.run(`UPDATE executions SET state = 'partial', sync_note = 'errors.EXECUTION_NOT_ACTIVE' WHERE id = ?`, [id]);
    await renderWithServices(t.services, <HomeScreen />);
    await fireEvent.press(await screen.findByTestId('stat-completed'));
    expect(await within(await screen.findByTestId(`occurrence-${OCC}`)).findByText('Server qəbul etmədi: Bu icra artıq bağlanıb və dəyişdirilə bilməz.')).toBeTruthy();
  });
});

describe('Needs correction (spec §8.1)', () => {
  const tr = i18n.t.bind(i18n);

  async function sentBack() {
    const t = await createTestServices();
    await t.seed(reworkSync(t.c, [{ itemId: t.c.temp.id, comment: 'Temperaturu yenidən ölçün' }, { itemId: t.c.photo.id, comment: 'Şəkil bulanıqdır' }]));
    return t;
  }

  it('lists runs sent back to me above today’s runs, with the round, the flagged items and the due date in the tenant’s time', async () => {
    const t = await sentBack();
    await renderWithServices(t.services, <HomeScreen />);
    const card = within(await screen.findByTestId(`occurrence-${OCC}`));
    // Runs sent back come first in the Tapşırıqlar list.
    expect(within(screen.getByTestId('section-myTasks')).getAllByTestId(/^occurrence-/)[0]?.props.testID).toBe(`occurrence-${OCC}`);
    expect(card.getByText(`${tr('corrections.round', { round: 1 })} · 2 bənd düzəliş tələb edir`)).toBeTruthy();
    const due = card.getByText(tr('corrections.dueAt', { date: formatDateTime(REWORK_DUE, { locale: 'az', timeZone: 'Asia/Baku' }) }));
    expect(StyleSheet.flatten(due.props.style).color).toBe(colors.muted);
    expect(card.queryByText('Gecikir')).toBeNull();
    await fireEvent.press(card.getByRole('button', { name: 'Düzəliş et: Açılış yoxlaması' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/execution/[id]', params: { id: OCC } });
  });

  it('turns the card red once the due date has passed', async () => {
    const t = await sentBack();
    t.clock.set(REWORK_DUE);
    await renderWithServices(t.services, <HomeScreen />);
    const card = within(await screen.findByTestId(`occurrence-${OCC}`));
    expect(card.getByText('Gecikir')).toBeTruthy();
    const due = card.getByText(tr('corrections.dueAt', { date: formatDateTime(REWORK_DUE, { locale: 'az', timeZone: 'Asia/Baku' }) }));
    expect(StyleSheet.flatten(due.props.style).color).toBe(colors.dangerText);
  });

  it('counts a run sent back to me among my tasks', async () => {
    const t = await sentBack();
    await renderWithServices(t.services, <HomeScreen />);
    expect(await within(await screen.findByTestId('section-myTasks')).findByText('1')).toBeTruthy();
  });
});
