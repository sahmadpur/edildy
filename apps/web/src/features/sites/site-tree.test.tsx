import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { SiteTree } from './site-tree';
import type { SiteNode } from './tree';

const node = (id: string, name: string, active: boolean): SiteNode => ({
  id,
  path: id,
  name,
  parentId: null,
  typeId: 't',
  address: null,
  active,
  depth: 0,
  children: [],
});

function renderTree(nodes: SiteNode[], onToggleActive = vi.fn(), canAddChild?: (n: SiteNode) => boolean) {
  renderWithProviders(
    <SiteTree
      nodes={nodes}
      typeName={() => 'Filial'}
      canManage
      canAddChild={canAddChild}
      onAddChild={vi.fn()}
      onEdit={vi.fn()}
      onMove={vi.fn()}
      onToggleActive={onToggleActive}
    />,
  );
  return onToggleActive;
}

describe('SiteTree', () => {
  it('asks for confirmation before deactivating a site', async () => {
    const onToggleActive = renderTree([node('a', 'Alfa', true)]);
    await userEvent.click(screen.getByRole('button', { name: 'Ləğv et' }));
    expect(onToggleActive).not.toHaveBeenCalled();
    expect(
      screen.getByText('«Alfa» ləğv edilsin? İçindəki zona və bölmələr avtomatik dəyişməyəcək.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Təsdiqlə' }));
    expect(onToggleActive).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('cancelling the confirmation keeps the site active', async () => {
    const onToggleActive = renderTree([node('a', 'Alfa', true)]);
    await userEvent.click(screen.getByRole('button', { name: 'Ləğv et' }));
    await userEvent.click(screen.getByRole('button', { name: 'İmtina et' }));
    expect(onToggleActive).not.toHaveBeenCalled();
  });

  it('reactivates without confirmation', async () => {
    const onToggleActive = renderTree([node('b', 'Bravo', false)]);
    await userEvent.click(screen.getByRole('button', { name: 'Bərpa et' }));
    expect(onToggleActive).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  it('renders each site as a box with worded actions, sub-sites nested inside the parent box', () => {
    const child: SiteNode = { ...node('b', 'Beta', true), parentId: 'a', depth: 1 };
    renderTree([{ ...node('a', 'Alfa', true), children: [child] }]);
    const alfa = screen.getByRole('treeitem', { name: 'Alfa' });
    expect(within(alfa).getByRole('treeitem', { name: 'Beta' })).toBeInTheDocument();
    expect(within(alfa).getAllByRole('button', { name: 'Düzəliş et' })[0]).toHaveTextContent('Düzəliş et');
    expect(within(alfa).getAllByRole('button', { name: 'Ləğv et' })[0]).toHaveTextContent('Ləğv et');
  });

  it('puts an icon before each worded action and hides adding inside the lowest level (feedback 2026-11-27)', () => {
    const child: SiteNode = { ...node('b', 'Beta', true), parentId: 'a', depth: 1 };
    renderTree([{ ...node('a', 'Alfa', true), children: [child] }], vi.fn(), (n) => n.id === 'a');
    const alfa = screen.getByRole('treeitem', { name: 'Alfa' });
    const beta = within(alfa).getByRole('treeitem', { name: 'Beta' });
    for (const name of ['Zona / bölmə', 'Düzəliş et', 'Köçür', 'Ləğv et']) {
      const button = within(alfa).getAllByRole('button', { name })[0]!;
      expect(button).toHaveTextContent(name);
      expect(button.querySelector('svg')).not.toBeNull();
    }
    expect(within(beta).queryByRole('button', { name: 'Zona / bölmə' })).toBeNull();
  });
});
