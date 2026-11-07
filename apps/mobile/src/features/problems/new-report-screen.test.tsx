import { act, fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import '@/lib/i18n';
import { capturedPhoto } from '@/offline/testing/fake-transport';
import { SITE, syncResponse, versionOf } from '@/offline/testing/fixtures';
import { eventually, renderWithServices } from '@/offline/testing/render';
import { createTestServices } from '@/offline/testing/test-services';
import type { Fix, LocationPort } from './location';
import { NewReportScreen } from './new-report-screen';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ router: { back: (...a: unknown[]) => mockBack(...a), push: jest.fn() } }));
jest.mock('@/features/execution/capture', () => ({ CaptureModal: () => null, VideoPreview: () => null, pickFromGallery: jest.fn() }));
const mockOpenSettings = jest.fn();
jest.mock('@/notifications/native', () => ({ openSettings: (...a: unknown[]) => mockOpenSettings(...a) }));
jest.mock('@/lib/session', () => ({
  useSession: () => ({ status: 'authenticated', offline: false, me: { user: { id: 'me', fullName: 'Aysel Əliyeva' }, permissions: [] } }),
}));

const fix: Fix = { lat: 40.4093, lng: 49.8671, accuracyM: 12.4, capturedAt: '2026-11-02T04:00:00.000Z' };
/** A port whose current-position call resolves only when the test says so. */
function controlledPort(permission: 'granted' | 'denied' = 'granted') {
  let resolveCurrent: ((f: Fix | null) => void) | null = null;
  const port: LocationPort = {
    requestPermission: async () => permission,
    current: () => new Promise<Fix | null>((resolve) => (resolveCurrent = resolve)),
    lastKnown: async () => null,
  };
  return { port, found: (f: Fix | null) => act(async () => resolveCurrent?.(f)) };
}
const gallery = () => (jest.requireMock('@/features/execution/capture') as { pickFromGallery: jest.Mock }).pickFromGallery;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.useRealTimers());

async function world() {
  const t = await createTestServices();
  await t.seed(syncResponse({ checklistVersions: [versionOf(t.c.content)], reportSites: [{ id: SITE, name: 'Bakı filialı 1' }, { id: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e41', name: 'Anbar' }] }));
  return t;
}

describe('NewReportScreen (2026-11-06 design §7.5)', () => {
  it('sends with the fix once found: the store gets the site, severity, text, location and the photo', async () => {
    const t = await world();
    const { port, found } = controlledPort();
    await renderWithServices(t.services, <NewReportScreen location={port} />);
    expect((await screen.findByTestId('location-status')).props.children).toBe('Yer axtarılır…');
    await found(fix);
    expect(await screen.findByText('Yer tapıldı (±12 m)')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Anbar' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Kritik' }));
    await fireEvent.changeText(screen.getByLabelText('Təsvir'), '  Anbarın qapısı bağlanmır ');
    gallery().mockResolvedValue(capturedPhoto(t.transport, { source: 'gallery' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Foto: Qalereya' }));
    expect(await screen.findByTestId('report-media-0')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Göndər' }));
    await eventually(async () => expect(mockBack).toHaveBeenCalled());
    const [report] = await t.services.reports.reports();
    expect(report!.server).toMatchObject({ siteId: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e41', siteName: 'Anbar', severity: 'critical', text: 'Anbarın qapısı bağlanmır', location: fix, reporter: { fullName: 'Aysel Əliyeva' } });
    expect(await t.services.reports.media(report!.id)).toHaveLength(1);
    expect(Alert.alert).toHaveBeenCalledWith('Problem göndərildi.');
  });

  it('after the timeout without a fix, send asks once and sends with location null', async () => {
    jest.useFakeTimers();
    const t = await world();
    const { port } = controlledPort();
    await renderWithServices(t.services, <NewReportScreen location={port} />);
    await fireEvent.changeText(await screen.findByLabelText('Təsvir'), 'Su axır');
    // The first site is preselected; the button waits for the fix.
    expect(screen.getByRole('button', { name: 'Yer axtarılır…' }).props.accessibilityState.disabled).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    jest.useRealTimers(); // the store and the polling helper below need real timers
    await fireEvent.press(screen.getByRole('button', { name: 'Göndər' }));
    const call = (Alert.alert as jest.Mock).mock.calls.find((c) => c[0] === 'Yer olmadan göndərilsin?');
    expect(call).toBeTruthy();
    const sendAnyway = (call![2] as { text: string; onPress: () => void }[]).find((b) => b.text === 'Göndər')!;
    await act(async () => sendAnyway.onPress());
    await eventually(async () => expect(mockBack).toHaveBeenCalled());
    const [report] = await t.services.reports.reports();
    expect(report!.server).toMatchObject({ siteId: SITE, text: 'Su axır', location: null, severity: 'normal' });
  });

  it('a denied permission shows the settings chip and still allows sending', async () => {
    const t = await world();
    const { port } = controlledPort('denied');
    await renderWithServices(t.services, <NewReportScreen location={port} />);
    expect(await screen.findByText('Yer icazəsi verilməyib.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Telefon ayarlarını aç' }));
    expect(mockOpenSettings).toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Təsvir'), 'Su axır');
    expect(screen.getByRole('button', { name: 'Göndər' }).props.accessibilityState.disabled).toBe(false);
  });

  it('refuses empty text and no site', async () => {
    const t = await createTestServices();
    await t.seed(syncResponse({ checklistVersions: [versionOf(t.c.content)], reportSites: [] }));
    const { port, found } = controlledPort();
    await renderWithServices(t.services, <NewReportScreen location={port} />);
    await found(fix);
    await fireEvent.press(await screen.findByRole('button', { name: 'Göndər' }));
    expect(await screen.findByText('Təsvir yazın.')).toBeTruthy();
    expect(screen.getByText('Obyekt seçin.')).toBeTruthy();
    expect(await t.services.reports.reports()).toEqual([]);
  });
});
