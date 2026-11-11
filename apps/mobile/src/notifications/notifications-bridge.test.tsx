import '@/lib/i18n';
import type { Subscription } from '@edildy/contracts';
import { ME, OCC, occurrence, OTHER, pushData, subscription, syncResponse, versionOf, XL_SUBSCRIPTION } from '@/offline/testing/fixtures';
import { eventually, renderWithServices } from '@/offline/testing/render';
import { createTestServices } from '@/offline/testing/test-services';
import { NotificationsBridge } from './notifications-bridge';
import { type FakeEvents, PUSH_TOKEN } from './testing/fakes';

const mockRegister = jest.fn();
const mockPush = jest.fn();
let mockSubscription: Subscription = XL_SUBSCRIPTION;
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/session', () => ({
  api: { pushDevices: { register: (...a: unknown[]) => mockRegister(...a), remove: jest.fn() } },
  useSession: () => ({ status: 'authenticated', offline: false, me: { permissions: [], role: { dataScope: 'own' }, tenant: { subscription: mockSubscription } } }),
}));
jest.mock('@/notifications/native', () => {
  const { fakeEvents, fakePush, fakeTokens } = jest.requireActual<typeof import('./testing/fakes')>('./testing/fakes');
  return { nativePush: fakePush(), pushTokenStore: fakeTokens(), notificationEvents: fakeEvents() };
});
jest.mock('@/offline/native/ports', () => ({ rnAppState: () => ({ subscribe: () => () => undefined }) }));
const native = jest.requireMock<{ notificationEvents: FakeEvents }>('@/notifications/native');

beforeEach(() => {
  mockRegister.mockReset();
  mockRegister.mockResolvedValue(undefined);
  mockPush.mockReset();
  mockSubscription = XL_SUBSCRIPTION;
  native.notificationEvents.last = null;
  native.notificationEvents.cleared = 0;
});

async function startedOnPhone() {
  const t = await createTestServices({ online: true });
  const res = syncResponse({ occurrences: [occurrence()], checklistVersions: [versionOf(t.c.content)] });
  await t.seed(res);
  t.api.sync = res;
  await t.services.store.start(OCC, ME);
  await t.services.engine.idle();
  return t;
}

describe('NotificationsBridge', () => {
  it('registers this phone for push once the signed-in app has opened, without waiting on anything', async () => {
    const t = await createTestServices();
    await renderWithServices(t.services, <NotificationsBridge />);
    await eventually(async () => expect(mockRegister).toHaveBeenCalledWith({ expoToken: PUSH_TOKEN, platform: 'android' }));
  });

  it('opens the checklist whose notification launched the app, once the local store is ready (cold start)', async () => {
    const t = await startedOnPhone();
    native.notificationEvents.last = { identifier: 'launch-1', data: pushData() };
    await renderWithServices(t.services, <NotificationsBridge />);
    await eventually(async () => expect(mockPush).toHaveBeenCalledWith({ pathname: '/execution/[id]', params: { id: OCC } }));
    native.notificationEvents.tap({ identifier: 'launch-1', data: pushData() });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(native.notificationEvents.cleared).toBe(1);
  });

  it("opens only the inbox for the previous user's notification on a shared phone", async () => {
    const t = await startedOnPhone();
    await renderWithServices(t.services, <NotificationsBridge />);
    native.notificationEvents.tap({ identifier: 'n-other', data: pushData({ userId: OTHER }) });
    await eventually(async () => expect(mockPush).toHaveBeenCalledWith({ pathname: '/notifications' }));
  });

  it('pulls when a notification arrives in the foreground', async () => {
    const t = await startedOnPhone();
    await renderWithServices(t.services, <NotificationsBridge />);
    const pulls = () => t.api.calls.filter((c) => c.method === 'pull').length;
    const before = pulls();
    native.notificationEvents.receive(pushData());
    await eventually(async () => expect(pulls()).toBe(before + 1));
  });

  describe('without notifications in the plan (BR-01)', () => {
    beforeEach(() => {
      mockSubscription = subscription({ without: ['notifications'] });
    });

    it('does not register this phone for push', async () => {
      const t = await createTestServices();
      await renderWithServices(t.services, <NotificationsBridge />);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('still opens a checklist from an older push, and Home for what would have opened the inbox', async () => {
      const t = await startedOnPhone();
      await renderWithServices(t.services, <NotificationsBridge />);
      native.notificationEvents.tap({ identifier: 'n-1', data: pushData() });
      await eventually(async () => expect(mockPush).toHaveBeenCalledWith({ pathname: '/execution/[id]', params: { id: OCC } }));
      native.notificationEvents.tap({ identifier: 'n-other', data: pushData({ userId: OTHER }) });
      await eventually(async () => expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/' }));
      expect(mockPush).not.toHaveBeenCalledWith({ pathname: '/notifications' });
    });
  });

});
