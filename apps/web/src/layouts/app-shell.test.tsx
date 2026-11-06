import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';

const state: { current: { status: string; me?: unknown } } = { current: { status: 'authenticated' } };
const listeners = new Set<() => void>();
const me = (permissions: string[]) => ({
  user: { id: 'u', fullName: 'Elvin Əhmədov', jobTitle: null, kind: 'staff', email: 'e@a.az', username: null, emailVerified: true, credentialKind: 'password', emailNotifications: true, locale: null },
  role: { id: 'r', name: 'Manager', systemKey: 'manager', dataScope: 'site_subtree' },
  permissions,
  tenant: { id: 't', name: 'Acme', orgCode: 'acme', timezone: 'Asia/Baku', locale: 'az' },
});

vi.mock('@/lib/session', () => ({
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
  localStorage.removeItem('taskop.nav.collapsed');
});

function renderShell(path = '/users') {
  const root = createRootRoute();
  const shell = createRoute({ getParentRoute: () => root, id: 'app', component: AppShell });
  const page = createRoute({ getParentRoute: () => shell, path: '/users', component: () => <p>users page</p> });
  const schedule = createRoute({ getParentRoute: () => shell, path: '/schedule', component: () => <p>schedule page</p> });
  const login = createRoute({ getParentRoute: () => root, path: '/login', component: () => <p>login page</p> });
  const router = createRouter({ routeTree: root.addChildren([shell.addChildren([page, schedule]), login]), history: createMemoryHistory({ initialEntries: [path] }) });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe('AppShell', () => {
  it('shows only the menu items the user may open', async () => {
    state.current = { status: 'authenticated', me: me(['users.view', 'sites.view']) };
    renderShell();
    expect(await screen.findByRole('link', { name: 'İşçilər' })).toBeInTheDocument();
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

  it('groups the menu into Ümumi, Əməliyyatlar and İdarəetmə, with no people group', async () => {
    state.current = { status: 'authenticated', me: me(['users.view', 'shifts.view', 'reports.view']) };
    renderShell();
    const nav = within(await screen.findByRole('navigation', { name: 'Menyu' }));
    expect(nav.getAllByRole('button').map((b) => b.textContent)).toEqual(['Ümumi', 'Əməliyyatlar', 'İdarəetmə']);
    // Növbələr is operational; İşçilər is administration.
    expect(nav.getAllByRole('link').map((l) => l.textContent)).toEqual(['Ana səhifə', 'Hesabatlar', 'Növbələr', 'İşçilər', 'Parametrlər']);
  });

  it('collapses a group on its heading and remembers that', async () => {
    state.current = { status: 'authenticated', me: me(['assignments.view']) };
    renderShell();
    const heading = await screen.findByRole('button', { name: 'Əməliyyatlar' });
    expect(heading).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(heading);
    expect(heading).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Problemlər' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('taskop.nav.collapsed') ?? '[]')).toEqual(['operations']);
  });

  it('keeps the group of the current page open even when it was collapsed', async () => {
    localStorage.setItem('taskop.nav.collapsed', JSON.stringify(['admin']));
    state.current = { status: 'authenticated', me: me(['users.view']) };
    renderShell('/users');
    expect(await screen.findByRole('link', { name: 'İşçilər' })).toHaveAttribute('aria-current', 'page');
  });

  it('folds and unfolds the group of the current page on its heading, and shows that', async () => {
    state.current = { status: 'authenticated', me: me(['users.view']) };
    renderShell('/users');
    const heading = await screen.findByRole('button', { name: 'İdarəetmə' });
    await userEvent.click(heading);
    expect(heading).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'İşçilər' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('taskop.nav.collapsed') ?? '[]')).toEqual(['admin']);
    await userEvent.click(heading);
    expect(heading).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'İşçilər' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('taskop.nav.collapsed') ?? '[]')).toEqual([]);
  });

  it('marks Təyinatlar current on the schedule page', async () => {
    state.current = { status: 'authenticated', me: me(['assignments.view']) };
    renderShell('/schedule');
    expect(await screen.findByRole('link', { name: 'Təyinatlar' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'İcra cədvəli' })).not.toBeInTheDocument();
  });

  it('shows the problems page to users who may view assignments', async () => {
    state.current = { status: 'authenticated', me: me(['assignments.view']) };
    renderShell();
    expect(await screen.findByRole('link', { name: 'Problemlər' })).toHaveAttribute('href', '/problems');
    expect(screen.getByRole('link', { name: 'Təyinatlar' })).toHaveAttribute('href', '/assignments');
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
});
