import { addDays, isoWeekday, type LocalDate } from '@edildy/contracts';

/** 'YYYY-MM' of a local date. */
export const monthOf = (date: LocalDate): string => date.slice(0, 7);

/** The month `n` months after `month` ('YYYY-MM'), `n` may be negative. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** The 42 days (six Monday-first weeks) a month calendar shows, starting on the Monday on or before the 1st. */
export function monthGrid(month: string): LocalDate[] {
  const first = `${month}-01`;
  const start = addDays(first, -(isoWeekday(first) - 1));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
