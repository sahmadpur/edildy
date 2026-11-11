import type { FeatureKey } from '@edildy/contracts';
import { render, screen } from '@testing-library/react-native';
import type { ComponentType, ReactNode } from 'react';
import '@/lib/i18n';
import { teamMe } from '@/features/team/testing/fixtures';
import { subscription } from '@/offline/testing/fixtures';
import AppLayout from '../../app/(app)/_layout';
import NotificationsRoute from '../../app/(app)/notifications';
import ReportRoute from '../../app/(app)/problems/[id]';
import ProblemsRoute from '../../app/(app)/problems/index';
import NewReportRoute from '../../app/(app)/problems/new';
import ReviewRoute from '../../app/(app)/review/[id]';
import TaskRoute from '../../app/(app)/task/[id]';
import NewTaskRoute from '../../app/(app)/task/new';
import TasksRoute from '../../app/(app)/tasks';
import TeamRoute from '../../app/(app)/team/index';
import TeamRunRoute from '../../app/(app)/team/run/[id]';

const mockScreens: { name: string; options?: { href?: null } }[] = [];
jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  const Tabs = ({ children }: { children: ReactNode }) => children;
  Tabs.Screen = (p: { name: string; options?: { href?: null } }) => {
    mockScreens.push(p);
    return null;
  };
  return { Tabs, Redirect: ({ href }: { href: string }) => <MockText>{`redirect ${href}`}</MockText>, useLocalSearchParams: () => ({ id: 'x', n: 'a' }) };
});
let mockSession: { status: string; offline?: boolean; me?: ReturnType<typeof teamMe> } = { status: 'authenticated', offline: false, me: teamMe() };
jest.mock('@/lib/session', () => ({ useSession: () => mockSession }));
jest.mock('@/offline/offline-provider', () => ({ OfflineProvider: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/notifications/notifications-bridge', () => ({ NotificationsBridge: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
// Every gated screen stands in as its name (a declaration: the hoisted factories call it before the module body runs).
function mockScreen(name: string) {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return () => <MockText>{`${name} screen`}</MockText>;
}
jest.mock('@/features/tasks/tasks-screen', () => ({ TasksScreen: mockScreen('tasks') }));
jest.mock('@/features/tasks/task-screen', () => ({ TaskScreen: mockScreen('task') }));
jest.mock('@/features/tasks/create-task-screen', () => ({ CreateTaskScreen: mockScreen('new task') }));
jest.mock('@/features/tasks/review-screen', () => ({ ReviewScreen: mockScreen('review') }));
jest.mock('@/features/problems/problems-screen', () => ({ ProblemsScreen: mockScreen('problems') }));
jest.mock('@/features/problems/new-report-screen', () => ({ NewReportScreen: mockScreen('new report') }));
jest.mock('@/features/problems/report-screen', () => ({ ReportScreen: mockScreen('report') }));
jest.mock('@/features/notifications/inbox-screen', () => ({ InboxScreen: mockScreen('inbox') }));
jest.mock('@/features/team/team-screen', () => ({ TeamScreen: mockScreen('team') }));
jest.mock('@/features/team/run-screen', () => ({ TeamRunScreen: mockScreen('team run') }));

const signedIn = (without: FeatureKey[] = []) => (mockSession = { status: 'authenticated', offline: false, me: teamMe({ subscription: subscription({ without }) }) });
const tab = (name: string) => mockScreens.find((s) => s.name === name)?.options;

const ROUTES: [string, ComponentType, FeatureKey][] = [
  ['tasks', TasksRoute, 'tasks'],
  ['task', TaskRoute, 'tasks'],
  ['new task', NewTaskRoute, 'tasks'],
  ['review', ReviewRoute, 'tasks'],
  ['problems', ProblemsRoute, 'problems'],
  ['new report', NewReportRoute, 'problems'],
  ['report', ReportRoute, 'problems'],
  ['inbox', NotificationsRoute, 'notifications'],
  ['team', TeamRoute, 'reports'],
  ['team run', TeamRunRoute, 'reports'],
];

beforeEach(() => {
  mockScreens.length = 0;
  signedIn();
});

describe('tabs on the plan (BR-01)', () => {
  it('shows Tapşırıqlar, Problemlər and Komanda on a plan with every feature', async () => {
    await render(<AppLayout />);
    for (const name of ['tasks', 'problems/index', 'team/index']) expect(tab(name)).not.toHaveProperty('href');
  });

  it('hides each tab whose feature the plan lacks, and only that one', async () => {
    const cases: [FeatureKey, string][] = [
      ['tasks', 'tasks'],
      ['problems', 'problems/index'],
      ['reports', 'team/index'],
    ];
    for (const [feature, name] of cases) {
      mockScreens.length = 0;
      signedIn([feature]);
      const view = await render(<AppLayout />);
      expect(tab(name)).toMatchObject({ href: null });
      for (const [, other] of cases.filter(([, n]) => n !== name)) expect(tab(other)).not.toHaveProperty('href');
      await view.unmount();
    }
  });

  it('keeps the other tabs on the smallest plan', async () => {
    signedIn(['notifications', 'usage_log', 'problems', 'tasks', 'reports', 'data_export', 'audits']);
    await render(<AppLayout />);
    for (const name of ['index', 'calendar', 'profile']) expect(tab(name)).not.toHaveProperty('href');
  });
});

describe('routes on the plan (BR-01)', () => {
  it.each(ROUTES)('%s opens on a plan with its feature', async (name, Route) => {
    await render(<Route />);
    expect(screen.getByText(`${name} screen`)).toBeTruthy();
  });

  it.each(ROUTES)('%s sends a deep link Home without its feature', async (name, Route, feature) => {
    signedIn([feature]);
    await render(<Route />);
    expect(screen.getByText('redirect /')).toBeTruthy();
    expect(screen.queryByText(`${name} screen`)).toBeNull();
  });

  it('renders nothing while signed out', async () => {
    mockSession = { status: 'anonymous' };
    const view = await render(<TasksRoute />);
    expect(view.toJSON()).toBeNull();
  });
});
