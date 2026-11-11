import type { PlatformTenantDto } from '@edildy/contracts';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PlatformTenantsTable } from './platform-tenants-page';

const tenant = (status: 'active' | 'suspended'): PlatformTenantDto => ({
  id: 't1', name: 'Acme MMC', orgCode: 'acme', status, userCount: 12, plan: 'pro', endsOn: '2026-12-31', subscriptionState: 'active', lastActivityAt: '2026-11-10T09:00:00.000Z', createdAt: '2026-10-07T10:00:00.000Z',
});

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

describe('PlatformTenantsTable', () => {
  it('confirms before suspending', async () => {
    const onSuspend = vi.fn();
    renderWithProviders(<PlatformTenantsTable tenants={[tenant('active')]} onSubscription={vi.fn()} onSuspend={onSuspend} onReactivate={vi.fn()} onOpenChecklists={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dayandır' }));
    expect(screen.getByText(/«Acme MMC» dayandırılsın/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Təsdiqlə' }));
    expect(onSuspend).toHaveBeenCalledWith('t1');
  });

  it('offers reactivation for suspended tenants', async () => {
    const onReactivate = vi.fn();
    renderWithProviders(<PlatformTenantsTable tenants={[tenant('suspended')]} onSubscription={vi.fn()} onSuspend={vi.fn()} onReactivate={onReactivate} onOpenChecklists={vi.fn()} onOpen={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Bərpa et' }));
    expect(onReactivate).toHaveBeenCalledWith('t1');
  });

  it('opens a tenant\'s checklists', async () => {
    const onOpenChecklists = vi.fn();
    renderWithProviders(<PlatformTenantsTable tenants={[tenant('active')]} onSubscription={vi.fn()} onSuspend={vi.fn()} onReactivate={vi.fn()} onOpenChecklists={onOpenChecklists} onOpen={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Yoxlama vərəqələri' }));
    expect(onOpenChecklists).toHaveBeenCalledWith('t1');
  });

  it('shows the plan and end date, flags a grace period, and opens the subscription', async () => {
    const onSubscription = vi.fn();
    renderWithProviders(
      <PlatformTenantsTable tenants={[{ ...tenant('active'), subscriptionState: 'grace' }]} onSubscription={onSubscription} onSuspend={vi.fn()} onReactivate={vi.fn()} onOpenChecklists={vi.fn()} onOpen={vi.fn()} />,
    );
    expect(screen.getByText(/31 dekabr 2026|31 dek 2026|31\.12\.2026/i)).toBeInTheDocument();
    expect(screen.getByText('Güzəşt müddəti')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Paketi dəyiş' }));
    expect(onSubscription).toHaveBeenCalledWith('t1');
  });
});
