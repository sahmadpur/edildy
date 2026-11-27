import type { SiteDto, SiteTypeDto } from '@edildy/contracts';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { MoveSiteDialog } from './move-site-dialog';

const types = [
  { id: 'filial', name: 'Filial', sortOrder: 0, active: true },
  { id: 'zona', name: 'Zona', sortOrder: 1, active: true },
  { id: 'bolme', name: 'Bölmə', sortOrder: 2, active: true },
] as SiteTypeDto[];
const s = (id: string, path: string, name: string, typeId = 'filial', parentId: string | null = null): SiteDto => ({
  id, path, name, parentId, typeId, address: null, active: true, depth: path.split('.').length - 1,
});
const sites = [s('a', 'a', 'Alfa'), s('a1', 'a.a1', 'Zona 1', 'zona', 'a'), s('b', 'b', 'Bravo'), s('b1', 'b.b1', 'Zona 2', 'zona', 'b'), s('b11', 'b.b1.b11', 'Bölmə 2', 'bolme', 'b1')];

describe('MoveSiteDialog', () => {
  it('offers only valid targets of a higher level and submits the choice (feedback 2026-11-27)', async () => {
    const onMove = vi.fn();
    renderWithProviders(<MoveSiteDialog site={sites[1]!} sites={sites} types={types} open onOpenChange={vi.fn()} onMove={onMove} />);
    const select = screen.getByLabelText('Yeni yer');
    const options = Array.from((select as HTMLSelectElement).options).map((o) => o.textContent?.trim());
    // A zone goes under a filial, not to the top, under another zone or under a bölmə.
    expect(options).toEqual(['Alfa', 'Bravo']);
    await userEvent.selectOptions(select, 'b');
    await userEvent.click(screen.getByRole('button', { name: 'Köçür' }));
    expect(onMove).toHaveBeenCalledWith('b');
  });

  it('lets a filial move only to the top', () => {
    renderWithProviders(<MoveSiteDialog site={sites[0]!} sites={sites} types={types} open onOpenChange={vi.fn()} onMove={vi.fn()} />);
    const options = Array.from((screen.getByLabelText('Yeni yer') as HTMLSelectElement).options).map((o) => o.textContent);
    expect(options).toEqual(['— Ən üst səviyyə —']);
  });
});
