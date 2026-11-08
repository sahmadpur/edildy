import { describe, expect, it } from 'vitest';
import { addMonths, monthGrid, monthOf } from './month-grid';

describe('month grid', () => {
  it('shows six Monday-first weeks around the month', () => {
    const days = monthGrid('2026-11');
    expect(days).toHaveLength(42);
    expect(days[0]).toBe('2026-10-26'); // 1 Nov 2026 is a Sunday
    expect(days[6]).toBe('2026-11-01');
    expect(days[41]).toBe('2026-12-06');
  });
  it('steps months across years', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-11', -13)).toBe('2025-10');
    expect(monthOf('2026-11-08')).toBe('2026-11');
  });
});
