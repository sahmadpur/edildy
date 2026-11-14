import type { PlatformTenantDetail, TenantActivity } from '@edildy/contracts';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { fixedSizeCharts } from '@/features/reports/chart-test-setup';

const mocks = vi.hoisted(() => ({ tenants: { get: vi.fn(), activity: vi.fn(), suspend: vi.fn(), reactivate: vi.fn(), setSubscription: vi.fn() } }));
vi.mock('./platform-session', () => ({ platformApi: { tenants: mocks.tenants } }));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => <a href={to} className={className}>{children}</a> }));
vi.mock('recharts', async (orig) => fixedSizeCharts(await orig()));

const { PlatformTenantPage } = await import('./platform-tenant-page');

const detail: PlatformTenantDetail = {
  id: 't1', name: 'Acme MMC', orgCode: 'acme', status: 'active', userCount: 12, plan: 'pro', endsOn: '2027-01-31', subscriptionState: 'active',
  lastActivityAt: '2026-11-10T09:00:00.000Z', createdAt: '2026-10-07T10:00:00.000Z', timezone: 'Asia/Baku', locale: 'az',
  subscription: { plan: 'pro', period: 'yearly', startsOn: '2026-02-01', endsOn: '2027-01-31', branchLimit: 2, extraFeatures: ['tasks'], staffLimitOverride: null, workerLimitOverride: 60 },
  usage: { staff: 4, workers: 8, branches: 2 },
  counts: { sites: 9, teams: 3, checklists: 5, assignments: 7 },
  owners: [{ id: 'o1', fullName: 'Leyla Quliyeva', email: 'leyla@acme.az', status: 'active' }],
};
const activity: TenantActivity = {
  lastActivityAt: '2026-11-10T09:00:00.000Z',
  activeUsers: { d7: 6, d30: 11 }, activeByClient: { web: 3, mobile: 8 }, logins: { d7: 14, d30: 52 }, runsCompleted: { d7: 40, d30: 170 },
  tasksCreated30: 9, problemReports30: 4,
  daily: Array.from({ length: 30 }, (_, i) => ({ date: `2026-10-${String(12 + (i % 19)).padStart(2, '0')}`, actions: i, users: 2, runs: 5 })),
  recent: [{ id: 'a1', actor: { type: 'user', id: 'u1', name: 'Nigar Səfərli' }, action: 'team.created', entityType: 'team', entityId: null, before: null, after: null, ip: null, client: 'web', occurredAt: '2026-11-10T09:00:00.000Z' }],
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  mocks.tenants.get.mockResolvedValue(detail);
  mocks.tenants.activity.mockResolvedValue(activity);
});

describe('PlatformTenantPage', () => {
  it('shows the organisation, its plan with add-ons and usage, its set-up and its activity', async () => {
    renderWithProviders(<PlatformTenantPage tenantId="t1" />);
    expect(await screen.findByRole('heading', { name: 'Acme MMC' })).toBeInTheDocument();
    expect(screen.getByText(/Leyla Quliyeva/)).toBeInTheDocument();
    expect(screen.getByText('Paket: Pro')).toBeInTheDocument();
    expect(screen.getByText('8 / 60')).toBeInTheDocument();
    expect(screen.getByText('Tapşırıqlar')).toBeInTheDocument();
    expect(screen.getByText('Filial, zona və bölmələr').nextSibling).toHaveTextContent('9');
    const section = await screen.findByRole('region', { name: 'Aktivlik' });
    expect(within(section).getByText('6 / 11')).toBeInTheDocument();
    expect(within(section).getByText('40 / 170')).toBeInTheDocument();
    expect(within(section).getByText('Nigar Səfərli')).toBeInTheDocument();
  });

  it('opens the plan dialog', async () => {
    renderWithProviders(<PlatformTenantPage tenantId="t1" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Paketi dəyiş' }));
    expect(await screen.findByRole('dialog', { name: /«Acme MMC» abunəliyi/ })).toBeInTheDocument();
  });
});
