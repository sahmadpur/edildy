import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { newDraft, parseDraft, SubscriptionFields, type SubscriptionDraft } from './subscription-fields';

function Harness({ onChange }: { onChange: (d: SubscriptionDraft) => void }) {
  const [d, setD] = useState(() => newDraft('2026-11-11'));
  return (
    <SubscriptionFields
      value={d}
      onChange={(next) => {
        setD(next);
        onChange(next);
      }}
    />
  );
}

describe('SubscriptionFields', () => {
  it('offers only add-ons the plan lacks and shows the price for the branches', async () => {
    let last = newDraft('2026-11-11');
    renderWithProviders(<Harness onChange={(d) => (last = d)} />);
    // Basic: every feature is an add-on.
    expect(screen.getByRole('checkbox', { name: 'Tapşırıqlar' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/Paket/), 'enterprise');
    expect(screen.queryByRole('checkbox', { name: 'Tapşırıqlar' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Audit' }));
    await userEvent.clear(screen.getByLabelText(/Filial sayı/));
    await userEvent.type(screen.getByLabelText(/Filial sayı/), '3');
    expect(screen.getByText(/Cəmi: 200 AZN\/ay/)).toBeInTheDocument();
    expect(parseDraft(last)).toMatchObject({ ok: true, value: { plan: 'enterprise', branchLimit: 3, extraFeatures: ['audits'], endsOn: '2027-11-11' } });
  });

  it('drops add-ons the new plan includes and accepts no end date', () => {
    const d = { ...newDraft('2026-11-11'), plan: 'xl' as const, extraFeatures: ['tasks' as const], noEnd: true, staffLimitOverride: '70' };
    expect(parseDraft(d)).toMatchObject({ ok: true, value: { extraFeatures: [], endsOn: null, staffLimitOverride: 70 } });
    expect(parseDraft({ ...d, noEnd: false, endsOn: '2026-01-01' })).toEqual({ ok: false, field: 'endsOn' });
  });
});
