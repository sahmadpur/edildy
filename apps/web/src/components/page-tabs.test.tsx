import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PageTabs } from './page-tabs';

describe('PageTabs', () => {
  it('renders the tabs as links, marks the current one and reports plain clicks', async () => {
    const onClick = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <PageTabs
        label="Təyinatlar"
        tabs={[
          { key: 'a', label: 'Təyinatlar', href: '/assignments', active: true },
          { key: 'b', label: 'İcra cədvəli', href: '/schedule', active: false, onClick },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Təyinatlar' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Təyinatlar' })).toHaveAttribute('aria-current', 'page');
    const other = screen.getByRole('link', { name: 'İcra cədvəli' });
    expect(other).toHaveAttribute('href', '/schedule');
    expect(other).not.toHaveAttribute('aria-current');
    await userEvent.click(other);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
