import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allRules, roleList } from '@/features/notifications/fixtures';
import { renderWithRouter } from '@/test/router';
import { SettingsPage } from './settings-page';

const mocks = vi.hoisted(() => ({
  permissions: { current: [] as string[] },
  features: { current: ['notifications'] as string[] },
  api: { tenant: { get: vi.fn(), subscription: vi.fn() }, notificationRules: { list: vi.fn() }, roles: { list: vi.fn(), catalog: vi.fn() } },
}));
vi.mock('@/lib/session', () => ({
  useFeature: (f: string) => mocks.features.current.includes(f),
  useFeatureOrStaff: () => true,
  api: mocks.api,
  useCan: (...keys: string[]) => keys.every((k) => mocks.permissions.current.includes(k)),
  session: { setMe: vi.fn() },
  useMe: () => ({ permissions: mocks.permissions.current }),
}));

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.resetAllMocks();
  mocks.api.tenant.get.mockResolvedValue({
    id: 't1',
    name: 'Acme',
    orgCode: 'acme',
    timezone: 'Asia/Baku',
    locale: 'az',
    status: 'active',
    createdAt: '2026-10-01T00:00:00.000Z',
  });
  mocks.api.notificationRules.list.mockResolvedValue(allRules());
  mocks.api.roles.list.mockResolvedValue(roleList());
  mocks.features.current = ['notifications'];
  mocks.api.tenant.subscription.mockResolvedValue({
    plan: 'pro',
    state: 'active',
    endsOn: '2027-11-10',
    features: ['notifications', 'usage_log', 'tasks'],
    limits: { staff: 20, workers: 50, branches: 2 },
    period: 'yearly',
    startsOn: '2026-11-11',
    usage: { staff: 20, workers: 7, branches: 1 },
  });
});

describe('SettingsPage', () => {
  it('without tenant.manage or notifications.manage keeps the page as it was, without tabs', async () => {
    mocks.permissions.current = [];
    renderWithRouter(<SettingsPage />, '/settings');
    expect(await screen.findByLabelText('Təşkilatın adı')).toHaveValue('Acme');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(mocks.api.notificationRules.list).not.toHaveBeenCalled();
  });

  it('with notifications.manage shows Təşkilat and Bildirişlər tabs; the rules load on their tab', async () => {
    mocks.permissions.current = ['tenant.manage', 'notifications.manage'];
    renderWithRouter(<SettingsPage />, '/settings');
    expect(await screen.findByLabelText('Təşkilatın adı')).toHaveValue('Acme');
    expect(screen.getByRole('tab', { name: 'Təşkilat' })).toHaveAttribute('aria-selected', 'true');
    expect(mocks.api.notificationRules.list).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('tab', { name: 'Bildirişlər' }));
    await waitFor(() => expect(mocks.api.notificationRules.list).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('region', { name: 'Tapşırıqlar' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Təşkilatın adı')).not.toBeInTheDocument();
  });

  it('shows Əməkdaş rolları as a tab for roles.view, opened by ?tab=roles (feedback 2026-11-11, item 16)', async () => {
    mocks.permissions.current = ['roles.view'];
    renderWithRouter(<SettingsPage tab="roles" />, '/settings?tab=roles');
    expect(await screen.findByRole('tab', { name: 'Əməkdaş rolları' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(mocks.api.roles.list).toHaveBeenCalled());
    expect(screen.getByRole('tab', { name: 'Təşkilat' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Bildirişlər' })).not.toBeInTheDocument();
  });

  it('shows the plan, its limits against usage and the included features on the Abunəlik tab (tenant.manage)', async () => {
    mocks.permissions.current = ['tenant.manage'];
    renderWithRouter(<SettingsPage tab="subscription" />, '/settings?tab=subscription');
    expect(await screen.findByText('Paket: Pro')).toBeInTheDocument();
    expect(screen.getByText('Aktiv')).toBeInTheDocument();
    expect(screen.getByText('20 / 20')).toHaveClass('text-status-bad-text');
    expect(screen.getByText('7 / 50')).toBeInTheDocument();
    const included = screen.getByRole('list', { name: 'Paketə daxildir' });
    expect(included).toHaveTextContent('Tapşırıqlar');
    expect(included).toHaveTextContent('Audit(Paketə daxil deyil)');
  });

  it('hides the Bildirişlər tab when the plan has no notifications', async () => {
    mocks.permissions.current = ['tenant.manage', 'notifications.manage'];
    mocks.features.current = [];
    renderWithRouter(<SettingsPage />, '/settings');
    expect(await screen.findByRole('tab', { name: 'Abunəlik' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Bildirişlər' })).not.toBeInTheDocument();
  });
});
