import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import '@/lib/i18n';
import { capturedPhoto } from '@/offline/testing/fake-transport';
import { REPORT, SITE, syncReport } from '@/offline/testing/fixtures';
import { eventually, renderWithServices } from '@/offline/testing/render';
import { createTestServices } from '@/offline/testing/test-services';
import { ReportScreen } from './report-screen';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: () => mockBack() } }));
let mockMe = { permissions: [] as string[], role: { dataScope: 'own' }, user: { id: 'me', fullName: 'Aysel Əliyeva' } };
const mockGet = jest.fn();
const mockClose = jest.fn();
const mockUrl = jest.fn();
jest.mock('@/lib/session', () => ({
  useSession: () => ({ status: 'authenticated', offline: false, me: mockMe }),
  api: {
    problemReports: { get: (...a: unknown[]) => mockGet(...a), close: (...a: unknown[]) => mockClose(...a) },
    problemReportMedia: { url: (...a: unknown[]) => mockUrl(...a) },
  },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/features/execution/capture', () => ({ VideoPreview: () => null }));

const input = { siteId: SITE, siteName: 'Bakı filialı 1', reporterName: 'Aysel Əliyeva', severity: 'critical' as const, text: 'Anbarın qapısı bağlanmır', location: { lat: 40.4093, lng: 49.8671, accuracyM: 12, capturedAt: '2026-11-02T04:00:00.000Z' } };

beforeEach(() => {
  jest.clearAllMocks();
  mockMe = { permissions: [], role: { dataScope: 'own' }, user: { id: 'me', fullName: 'Aysel Əliyeva' } };
  mockUrl.mockResolvedValue({ url: 'http://files.test/x', expiresAt: '2026-11-02T05:00:00.000Z' });
});

describe('ReportScreen', () => {
  it('shows a local report with its pending photo and the map link, and no manager buttons for a worker', async () => {
    const t = await createTestServices();
    await t.seed();
    const id = await t.services.reports.create(input, [capturedPhoto(t.transport)]);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderWithServices(t.services, <ReportScreen id={id} remote={false} />);
    expect(await screen.findByText('Anbarın qapısı bağlanmır')).toBeTruthy();
    expect(screen.getByText('Kritik')).toBeTruthy();
    expect(screen.getByText('Bakı filialı 1')).toBeTruthy();
    expect(screen.getByText('Aysel Əliyeva')).toBeTruthy();
    expect(screen.getByText('Göndərilməyib')).toBeTruthy();
    expect(screen.getByTestId('local-media-0')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Xəritədə aç' }));
    expect(open).toHaveBeenCalledWith('https://maps.apple.com/?ll=40.4093,49.8671&q=40.4093,49.8671');
    expect(screen.queryByRole('button', { name: 'Tapşırıq yarat' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bağla' })).toBeNull();
  });

  it('a report without location says so', async () => {
    const t = await createTestServices();
    await t.seed();
    const id = await t.services.reports.create({ ...input, location: null }, []);
    await renderWithServices(t.services, <ReportScreen id={id} remote={false} />);
    expect(await screen.findByText('Yer məlum deyil')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xəritədə aç' })).toBeNull();
  });

  it('a manager online sees Tapşırıq yarat and Bağla on a remote open report, and closing posts the comment', async () => {
    mockMe = { permissions: ['assignments.view', 'tasks.manage'], role: { dataScope: 'site_subtree' }, user: { id: 'me', fullName: 'Rəşad' } };
    mockGet.mockResolvedValue(syncReport({ id: REPORT, reporter: { id: 'u2', fullName: 'Fərid' }, media: [{ id: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e90', kind: 'photo', status: 'uploaded' }] }));
    mockClose.mockResolvedValue(syncReport({ id: REPORT, state: 'closed', closedAt: '2026-11-02T05:00:00.000Z', closedBy: { id: 'me', fullName: 'Rəşad' }, closeComment: 'Yerində düzəldildi' }));
    const t = await createTestServices({ online: true });
    await t.seed();
    await renderWithServices(t.services, <ReportScreen id={REPORT} remote />);
    expect(await screen.findByText('Fərid')).toBeTruthy();
    expect(await screen.findByTestId('remote-0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e90')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tapşırıq yarat' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/task/new', params: expect.objectContaining({ problemReportId: REPORT }) });
    await fireEvent.press(screen.getByRole('button', { name: 'Bağla' }));
    const field = await screen.findByLabelText('Şərh');
    await fireEvent.changeText(field, 'Yerində düzəldildi');
    await fireEvent.press(screen.getByRole('button', { name: 'Problemi bağla' }));
    await eventually(async () => expect(mockClose).toHaveBeenCalledWith(REPORT, { comment: 'Yerində düzəldildi' }));
    expect(await screen.findByText('Rəşad bağladı: Yerində düzəldildi')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bağla' })).toBeNull();
  });

  it('a worker opening a remote report that is not theirs sees the not-found text when the API refuses', async () => {
    mockGet.mockRejectedValue(new Error('404'));
    const t = await createTestServices({ online: true });
    await t.seed();
    await renderWithServices(t.services, <ReportScreen id={REPORT} remote />);
    expect(await screen.findByText('Problem bu telefonda yoxdur.')).toBeTruthy();
  });
});
