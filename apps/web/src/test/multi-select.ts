import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** Opens the MultiSelectFilter named `label` and ticks `options` (by their visible label), then closes it. */
export async function tickOptions(label: string, options: readonly (string | RegExp)[]): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: label }));
  const group = within(await screen.findByRole('group', { name: label }));
  for (const name of options) await userEvent.click(group.getByRole('checkbox', { name }));
  await userEvent.keyboard('{Escape}');
}

/** The visible options of an open-and-closed MultiSelectFilter named `label`, the "all" tick first. */
export async function filterOptions(label: string): Promise<string[]> {
  await userEvent.click(screen.getByRole('button', { name: label }));
  const group = within(await screen.findByRole('group', { name: label }));
  const names = group.getAllByRole('checkbox').map((c) => c.parentElement?.textContent ?? '');
  await userEvent.keyboard('{Escape}');
  return names;
}
