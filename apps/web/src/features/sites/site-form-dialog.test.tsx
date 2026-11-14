import type { SiteDto, SiteTypeDto } from '@edildy/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SiteFormDialog } from './site-form-dialog';

const filial: SiteTypeDto = {
  id: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e01',
  name: 'Filial',
  active: true,
} as SiteTypeDto;

describe('SiteFormDialog', () => {
  it('keeps the name typed while the site types were still loading', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    // Plain render: the dialog needs no providers, and `rerender` must keep the same tree so the form is not remounted.
    const { rerender } = render(
      <SiteFormDialog open onOpenChange={() => {}} types={[]} onSubmit={onSubmit} />,
    );
    await userEvent.type(screen.getByLabelText('Ad'), 'Anbar №1');
    // The types query answers after the user started typing: the form re-syncs its defaults, the typed name must stay.
    rerender(<SiteFormDialog open onOpenChange={() => {}} types={[filial]} onSubmit={onSubmit} />);
    await waitFor(() => expect(screen.getByLabelText('Növ')).toHaveValue(filial.id));
    expect(screen.getByLabelText('Ad')).toHaveValue('Anbar №1');
    await userEvent.click(screen.getByRole('button', { name: 'Yadda saxla' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Anbar №1', typeId: filial.id, address: '' }),
    );
  });

  it('starts a place inside another one level down: Zona under a Filial (feedback 2026-11-14)', () => {
    const t = (id: string, name: string, sortOrder: number) => ({ id, name, sortOrder, active: true }) as SiteTypeDto;
    const types = [t('0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e01', 'Filial', 0), t('0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e02', 'Zona', 1), t('0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e03', 'Bölmə', 2)];
    const parent = { id: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e10', typeId: types[0]!.id, name: 'Baş filial' } as SiteDto;
    render(<SiteFormDialog open onOpenChange={() => {}} types={types} parent={parent} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Növ')).toHaveValue(types[1]!.id);
  });
});
