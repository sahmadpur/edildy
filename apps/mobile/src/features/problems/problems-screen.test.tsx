import { fireEvent, screen, within } from '@testing-library/react-native';
import '@/lib/i18n';
import { REPORT, REPORT2, SITE, syncReport, syncResponse, versionOf, XL_SUBSCRIPTION } from '@/offline/testing/fixtures';
import { eventually, renderWithServices } from '@/offline/testing/render';
import { createTestServices } from '@/offline/testing/test-services';
import { ProblemsScreen } from './problems-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
let mockMe = { permissions: [] as string[], role: { dataScope: 'own' }, user: { id: 'me', fullName: 'Aysel Əliyeva' }, tenant: { subscription: XL_SUBSCRIPTION } };
const mockList = jest.fn();
jest.mock('@/lib/session', () => ({
  useSession: () => ({ status: 'authenticated', offline: false, me: mockMe }),
  api: { problemReports: { list: (...a: unknown[]) => mockList(...a) } },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const input = { siteId: SITE, siteName: 'Bakı filialı 1', reporterName: 'Aysel Əliyeva', severity: 'normal' as const, text: 'Anbarın qapısı bağlanmır', location: null };

beforeEach(() => {
  mockPush.mockClear();
  mockMe = { permissions: [], role: { dataScope: 'own' }, user: { id: 'me', fullName: 'Aysel Əliyeva' }, tenant: { subscription: XL_SUBSCRIPTION } };
  mockList.mockReset();
  mockList.mockResolvedValue({ items: [], nextCursor: null });
});

describe('Problemlər', () => {
  it('lists my reports newest first with the sync badge and the state, and opens one', async () => {
    const t = await createTestServices();
    await t.seed(syncResponse({ checklistVersions: [versionOf(t.c.content)], problemReports: [syncReport({ id: REPORT, text: 'Köhnə', state: 'closed', closedAt: '2026-11-01T08:00:00.000Z' })] }));
    const id = await t.services.reports.create({ ...input, text: 'Təzə problem' }, []);
    await renderWithServices(t.services, <ProblemsScreen />);
    const rows = await screen.findAllByTestId(/^report-/);
    expect(rows.map((r) => r.props.testID)).toEqual([`report-${id}`, `report-${REPORT}`]);
    expect(within(rows[0]!).getByText('Göndərilməyib')).toBeTruthy();
    expect(within(rows[0]!).getByText('Açıq')).toBeTruthy();
    expect(within(rows[1]!).getByText('Bağlanıb')).toBeTruthy();
    expect(screen.queryByText('Hamısı')).toBeNull();
    await fireEvent.press(rows[1]!);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/problems/[id]', params: { id: REPORT } });
  });

  it('shows the report button only when the user has a site, else the explanation', async () => {
    const t = await createTestServices();
    await t.seed(syncResponse({ checklistVersions: [versionOf(t.c.content)], reportSites: [] }));
    await renderWithServices(t.services, <ProblemsScreen />);
    expect(await screen.findByText('Sizə heç bir obyekt təyin edilməyib.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Problem bildir' })).toBeNull();
    await t.seed(syncResponse({ checklistVersions: [versionOf(t.c.content)] }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Problem bildir' }));
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/problems/new' }));
  });

  it('a manager sees Mənim | Hamısı, and Hamısı lists the scope from the API with the active filter', async () => {
    mockMe = { permissions: ['assignments.view', 'tasks.manage'], role: { dataScope: 'site_subtree' }, user: { id: 'me', fullName: 'Rəşad' }, tenant: { subscription: XL_SUBSCRIPTION } };
    mockList.mockResolvedValue({ items: [syncReport({ id: REPORT2, text: 'Başqasının problemi', reporter: { id: 'u2', fullName: 'Fərid' } })], nextCursor: null });
    const t = await createTestServices({ online: true });
    await t.seed();
    await renderWithServices(t.services, <ProblemsScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Hamısı' }));
    expect(await screen.findByText('Başqasının problemi')).toBeTruthy();
    expect(mockList).toHaveBeenCalledWith({ state: 'active', limit: 30 });
    await fireEvent.press(screen.getByRole('radio', { name: 'Bağlı' }));
    await eventually(async () => expect(mockList).toHaveBeenLastCalledWith({ state: 'closed', limit: 30 }));
    await fireEvent.press(screen.getByTestId(`report-${REPORT2}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/problems/[id]', params: { id: REPORT2, remote: '1' } });
  });
});
