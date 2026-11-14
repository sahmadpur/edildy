import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Canvas } from './canvas';
import { indexIssues } from './issues';
import { treeFixture } from './fixtures';

describe('Canvas', () => {
  it('shows the section of the selected item with its ordinal and the questions as read-only text', async () => {
    const f = treeFixture();
    const dispatch = vi.fn();
    renderWithProviders(<Canvas content={f.content} selected={{ kind: 'item', id: f.c.id }} issues={indexIssues(f.content, [])} dispatch={dispatch} readOnly={false} />);
    expect(screen.getByLabelText('İkinci bölmənin adı')).toHaveValue('S2');
    expect(screen.queryByDisplayValue('C')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'C' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'select', node: { kind: 'item', id: f.c.id } });
  });

  it('opens the section guidance box with + and removes it with ×', async () => {
    const f = treeFixture();
    const dispatch = vi.fn();
    renderWithProviders(<Canvas content={f.content} selected={{ kind: 'section', id: f.s1.id }} issues={indexIssues(f.content, [])} dispatch={dispatch} readOnly={false} />);
    expect(screen.queryByLabelText('Bölmə üzrə göstəriş')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bölmə üzrə göstəriş' }));
    const box = screen.getByLabelText('Bölmə üzrə göstəriş');
    expect(box).toHaveFocus();
    fireEvent.change(box, { target: { value: 'Əlcək taxın' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'updateSection', sectionId: f.s1.id, patch: { instructions: 'Əlcək taxın' } });
    await userEvent.click(screen.getByRole('button', { name: 'Göstərişi sil' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'updateSection', sectionId: f.s1.id, patch: { instructions: null } });
    expect(screen.queryByLabelText('Bölmə üzrə göstəriş')).not.toBeInTheDocument();
  });

  it('adds an item of the chosen type after a card', async () => {
    const f = treeFixture();
    const dispatch = vi.fn();
    renderWithProviders(<Canvas content={f.content} selected={{ kind: 'section', id: f.s1.id }} issues={indexIssues(f.content, [])} dispatch={dispatch} readOnly={false} />);
    await userEvent.click(screen.getAllByRole('button', { name: '+ Sual əlavə et' })[1]!);
    await userEvent.click(screen.getByRole('button', { name: 'Rəqəm' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'addItem', container: { kind: 'section', sectionId: f.s1.id }, index: 1, itemType: 'number' });
  });
});
