import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AuditDiff, diffEntries } from './audit-diff';

describe('diffEntries', () => {
  it('lists only changed top-level keys', () => {
    expect(diffEntries({ name: 'A', tz: 'Asia/Baku', n: [1] }, { name: 'B', tz: 'Asia/Baku', n: [1] })).toEqual([{ key: 'name', before: 'A', after: 'B' }]);
  });
  it('treats a creation (no before) as all keys added', () => {
    expect(diffEntries(null, { name: 'A' })).toEqual([{ key: 'name', before: undefined, after: 'A' }]);
  });
  it('handles non-object payloads', () => {
    expect(diffEntries(null, null)).toEqual([]);
  });
});

describe('AuditDiff', () => {
  const fmt = (iso: string) => `at ${iso.slice(0, 10)}`;
  it('names fields and values in the reader\'s language', () => {
    renderWithProviders(<AuditDiff before={{ status: 'active', late: false }} after={{ status: 'deactivated', late: true }} formatDateTime={fmt} />);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Gecikib')).toBeInTheDocument();
    expect(screen.getByText('Aktiv')).toBeInTheDocument();
    expect(screen.getByText('Deaktiv')).toBeInTheDocument();
    expect(screen.getByText('Bəli')).toBeInTheDocument();
    expect(screen.queryByText('late')).not.toBeInTheDocument();
  });
  it('formats dates, ids and nested data and hides internal fields', () => {
    renderWithProviders(
      <AuditDiff
        before={null}
        after={{ completedAt: '2026-11-14T08:00:00.000Z', occurrenceId: '0199a1b2-0000-7000-8000-00000000abcd', filters: { a: 1 }, path: 'x.y', siteIds: ['0199a1b2-0000-7000-8000-00000000abcd'] }}
        formatDateTime={fmt}
      />,
    );
    expect(screen.getByText('at 2026-11-14')).toBeInTheDocument();
    expect(screen.getByText('#00abcd')).toBeInTheDocument();
    expect(screen.getByText('dəyişdirilib')).toBeInTheDocument();
    expect(screen.getByText('1 element')).toBeInTheDocument();
    expect(screen.queryByText('x.y')).not.toBeInTheDocument();
  });
});
