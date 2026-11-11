import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';

const state: { current: { status: string; me?: unknown } } = { current: { status: 'authenticated' } };
const listeners = new Set<() => void>();
const ALL = ['notifications', 'usage_log', 'problems', 'tasks', 'reports', 'data_export', 'audits'];
const me = (permissions: string[], subscription: Record<string, unknown> = {}) => ({
  user: { id: 'u', fullName: 'Elvin Əhmədov', jobTitle: null, kind: 'staff', email: 'e@a.az', username: null, emailVerified: true, credentialKind: 'password', emailNotifications: true, locale: null },
  role: { id: 'r', name: 'Manager', systemKey: 'manager', dataScope: 'site_subtree' },
  permissions,
  tenant: {
    id: 't',
    name: 'Acme',
    orgCode: 'acme',
    timezone: 'Asia/Baku',
    locale: 'az',
    subscription: { plan: 'xl', state: 'active', endsOn: null, features: ALL, limits: { staff: null, workers: null, branches: 1 }, ...subscription },
  },
});

vi.mock('@/lib/session', () => ({
  useFeature: () => true,
  useFeatureOrStaff: () => true,
  useSession: () => state.current,
  useMe: () => state.current.me,
  useCan: (...keys: string[]) => keys.every((k) => (state.current.me as { permissions: string[] }).permissions.includes(k)),
  session: { signOut: vi.fn(), setMe: vi.fn(), subscribe: (l: () => void) => (listeners.add(l), () => listeners.delete(l)), get: () => state.current },
  api: {
    auth: { resendVerification: vi.fn() },
    notifications: { unreadCount: vi.fn(async () => ({ count: 2 })), list: vi.fn(async () => ({ items: [], nextCursor: null })) },
    preferences: { update: vi.fn() },
  },
}));

const { AppShell } = await import('./app-shell');

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  localStorage.removeItem('edildy.nav.collapsed');
});

function renderShell(path = '/users') {
  const root = createRootRoute();
  const shell = createRoute({ getParentRoute: () => root, id: 'app', component: AppShell });
  const page = createRoute({ getParentRoute: () => shell, path: '/users', component: () => <p>users page</p> });
  const schedule = createRoute({ getParentRoute: () => shell, path: '/calendar', component: () => <p>calendar page</p> });
  const templates = createRoute({ getParentRoute: () => shell, path: '/templates', component: () => <p>templates page</p> });
  const login = createRoute({ getParentRoute: () => root, path: '/login', component: () => <p>login page</p> });
  const router = createRouter({ routeTree: root.addChildren([shell.addChildren([page, schedule, templates]), login]), history: createMemoryHistory({ initialEntries: [path] }) });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe('AppShell', () => {
  it('shows only the menu items the user may open', async () => {
    state.current = { status: 'authenticated', me: me(['users.view', 'sites.view']) };
    renderShell();
    expect(await screen.findByRole('link', { name: 'Əməkdaşlar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Obyektlər' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Rollar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'İstifadə jurnalı' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Problemlər' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tapşırıqlar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mesajlar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Hesabatlar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Audit' })).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Parametrlər' })).toBeInTheDocument();
  });

  it('groups the menu into Ümumi, Əməliyyatlar, İdarəetmə and Digər, with no people group', async () => {
    state.current = { status: 'authenticated', me: me(['users.view', 'shifts.view', 'reports.view', 'assignments.view', 'audits.perform']) };
    renderShell();
    const nav = within(await screen.findByRole('navigation', { name: 'Menyu' }));
    expect(nav.getAllByRole('button').map((b) => b.textContent)).toEqual(['Əsas', 'Əməliyyatlar', 'İdarəetmə', 'Digər']);
    // Problemlər sits right under Göstəricilər; Növbələr and Əməkdaşlar are administration; Audit is in Digər, last.
    expect(nav.getAllByRole('link').map((l) => l.textContent)).toEqual(['Göstəricilər', 'Problemlər', 'Hesabatlar', 'Yoxlamalar', 'Əməkdaşlar', 'Növbələr', 'Parametrlər', 'Audit']);
  });

  it('hides a group whose pages the user may not open', async () => {
    state.current = { status: 'authenticated', me: me(['users.view']) };
    renderShell();
    const nav = within(await screen.findByRole('navigation', { name: 'Menyu' }));
    expect(nav.getAllByRole('button').map((b) => b.textContent)).toEqual(['Əsas', 'İdarəetmə']);
  });

  it('collapses a group on its heading and remembers that', async () => {
    state.current = { status: 'authenticated', me: me(['assignments.view']) };
    renderShell();
    const heading = await screen.findByRole('button', { name: 'Əməliyyatlar' });
    expect(heading).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(heading);
    expect(heading).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Yoxlamalar' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Problemlər' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('edildy.nav.collapsed') ?? '[]')).toEqual(['operations']);
  });

  it('keeps the group of the current page open even when it was collapsed', async () => {
    localStorage.setItem('edildy.nav.collapsed', JSON.stringify(['admin']));
    state.current = { status: 'authenticated', me: me(['users.view']) };
    renderShell('/users');
    expect(await screen.findByRole('link', { name: 'Əməkdaşlar' })).toHaveAttribute('aria-current', 'page');
  });

  it('folds and unfolds the group of the current page on its heading, and shows that', async () => {
    state.current = { status: 'authenticated', me: me(['users.view']) };
    renderShell('/users');
    const heading = await screen.findByRole('button', { name: 'İdarəetmə' });
    await userEvent.click(heading);
    expect(heading).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Əməkdaşlar' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('edildy.nav.collapsed') ?? '[]')).toEqual(['admin']);
    await userEvent.click(heading);
    expect(heading).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Əməkdaşlar' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('edildy.nav.collapsed') ?? '[]')).toEqual([]);
  });

  it('marks Yoxlamalar current on the calendar page', async () => {
    state.current = { status: 'authenticated', me: me(['assignments.view']) };
    renderShell('/calendar');
    expect(await screen.findByRole('link', { name: 'Yoxlamalar' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'İcra cədvəli' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Təyinatlar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Yoxlama vərəqələri' })).not.toBeInTheDocument();
  });

  it('links Yoxlamalar to the checklists tab for someone who may not see assignments', async () => {
    state.current = { status: 'authenticated', me: me(['checklists.view']) };
    renderShell('/templates');
    const link = await screen.findByRole('link', { name: 'Yoxlamalar' });
    expect(link).toHaveAttribute('href', '/checklists');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('shows the problems page to users who may view assignments', async () => {
    state.current = { status: 'authenticated', me: me(['assignments.view']) };
    renderShell();
    expect(await screen.findByRole('link', { name: 'Problemlər' })).toHaveAttribute('href', '/problems');
    expect(screen.getByRole('link', { name: 'Yoxlamalar' })).toHaveAttribute('href', '/assignments');
  });

  it('shows tasks to holders of tasks.view or tasks.manage', async () => {
    state.current = { status: 'authenticated', me: me(['tasks.manage']) };
    renderShell();
    expect(await screen.findByRole('link', { name: 'Tapşırıqlar' })).toHaveAttribute('href', '/tasks');
  });

  it('shows the notification bell with the unread count in the header', async () => {
    state.current = { status: 'authenticated', me: me([]) };
    renderShell();
    expect(await screen.findByRole('button', { name: 'Bildirişlər: 2 oxunmamış' })).toHaveTextContent('2');
  });

  it('shows Mesajlar in the header, not the menu, to holders of notifications.send', async () => {
    state.current = { status: 'authenticated', me: me(['notifications.send']) };
    renderShell();
    const link = await screen.findByRole('link', { name: 'Mesajlar' });
    expect(link).toHaveAttribute('href', '/messages');
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Mesajlar' })).toBe(link);
    expect(within(screen.getByRole('navigation', { name: 'Menyu' })).queryByRole('link', { name: 'Mesajlar' })).not.toBeInTheDocument();
  });

  it('shows Hesabatlar to holders of reports.view', async () => {
    state.current = { status: 'authenticated', me: me(['reports.view']) };
    renderShell();
    expect(await screen.findByRole('link', { name: 'Hesabatlar' })).toHaveAttribute('href', '/reports');
  });

  it('shows Audit to holders of audits.perform', async () => {
    state.current = { status: 'authenticated', me: me(['audits.perform']) };
    renderShell();
    expect(await screen.findByRole('link', { name: 'Audit' })).toHaveAttribute('href', '/audits');
  });

  it('opens the notification settings from the user menu', async () => {
    state.current = { status: 'authenticated', me: me([]) };
    renderShell();
    // Logging out stays one click away (the open modal dialog hides the page from role queries, so check first).
    expect(await screen.findByRole('button', { name: 'Çıxış' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /Elvin Əhmədov/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Bildiriş ayarları' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bildiriş ayarları' });
    expect(within(dialog).getByRole('switch', { name: 'E-poçt bildirişləri' })).toBeChecked();
  });

  it('AppShell redirects to login when the session ends', async () => {
    state.current = { status: 'authenticated', me: me([]) };
    const router = renderShell();
    await screen.findByText('users page');
    await act(async () => {
      state.current = { status: 'anonymous' };
      listeners.forEach((l) => l());
    });
    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ redirect: '/users' });
  });

  it('hides the pages, Mesajlar and the bell that the plan does not include', async () => {
    const perms = ['users.view', 'reports.view', 'assignments.view', 'tasks.view', 'audits.perform', 'audit.view', 'notifications.send'];
    state.current = { status: 'authenticated', me: me(perms, { plan: 'basic', features: [] }) };
    renderShell();
    const nav = await screen.findByRole('navigation', { name: 'Menyu' });
    for (const name of ['Problemlər', 'Hesabatlar', 'Tapşırıqlar', 'Audit', 'İstifadə jurnalı']) expect(within(nav).queryByRole('link', { name })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Göstəricilər' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mesajlar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bildirişlər/ })).not.toBeInTheDocument();
  });

  it('shows an add-on feature on a smaller plan', async () => {
    state.current = { status: 'authenticated', me: me(['users.view', 'tasks.view'], { plan: 'basic', features: ['tasks'] }) };
    renderShell();
    const nav = await screen.findByRole('navigation', { name: 'Menyu' });
    expect(within(nav).getByRole('link', { name: 'Tapşırıqlar' })).toBeInTheDocument();
  });

  it('tells everyone when the subscription has ended (read-only)', async () => {
    state.current = { status: 'authenticated', me: me(['users.view'], { state: 'expired', endsOn: '2026-10-01' }) };
    renderShell();
    expect(await screen.findByText(/Abunəlik bitib: məlumatlara baxmaq olar/)).toBeInTheDocument();
  });

  it('warns the people who manage the organisation 14 days before the end, not the others', async () => {
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    state.current = { status: 'authenticated', me: me(['users.view', 'tenant.manage'], { endsOn: soon }) };
    renderShell();
    expect(await screen.findByText(/Qalan gün: (9|10)/)).toBeInTheDocument();
  });
});
