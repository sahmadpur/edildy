import type { AuditEntryDto } from '@edildy/contracts';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AuditPage } from './audit-page';
import { filterOptions, tickOptions } from '@/test/multi-select';

const mocks = vi.hoisted(() => ({ api: { audit: { list: vi.fn() } } }));
vi.mock('@/lib/session', () => ({
  api: mocks.api,
  useCan: () => true,
  useMe: () => ({ tenant: { timezone: 'Asia/Baku' } }),
}));

const entry = (over: Partial<AuditEntryDto> = {}): AuditEntryDto => ({
  id: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e01',
  actor: { type: 'user', id: 'u1', name: 'Aynur Quliyeva' },
  action: 'execution.completed',
  entityType: 'execution',
  entityId: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e02',
  before: { state: 'active' },
  after: { state: 'completed' },
  ip: null,
  client: 'mobile',
  occurredAt: '2026-11-06T09:30:00.000Z',
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.audit.list.mockResolvedValue({
    items: [
      entry(),
      entry({
        id: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e03',
        action: 'team.created',
        entityType: 'team',
        client: 'web',
      }),
    ],
    nextCursor: null,
  });
});

describe('AuditPage (İstifadə jurnalı)', () => {
  it('shows where each entry came from and names the run and task actions', async () => {
    renderWithProviders(<AuditPage />);
    await screen.findByText('Komanda yaradıldı');
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Mənbə');
    expect(rows[1]).toHaveTextContent('Mobil');
    expect(rows[1]).toHaveTextContent('Yoxlama tamamlandı');
    expect(rows[2]).toHaveTextContent('Veb');
    expect(rows[2]).toHaveTextContent('Komanda yaradıldı');
    // Only labels, never the raw code (feedback 2026-11-11, item 9).
    expect(screen.queryByText('team.created')).not.toBeInTheDocument();
  });

  it('filters by source and offers runs and tasks as element types', async () => {
    renderWithProviders(<AuditPage />);
    await screen.findByText('Komanda yaradıldı');
    expect(await filterOptions('Mənbə')).toEqual(['Hamısı', 'Veb', 'Mobil']);
    await tickOptions('Mənbə', ['Mobil']);
    await waitFor(() =>
      expect(mocks.api.audit.list).toHaveBeenLastCalledWith(expect.objectContaining({ client: 'mobile' })),
    );
    const types = await filterOptions('Element növü');
    expect(types).toEqual(expect.arrayContaining(['İcra', 'Tapşırıq']));
  });
});
