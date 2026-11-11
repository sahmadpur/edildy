import type { Me, ProblemReportState } from '@edildy/contracts';
import type { Tone } from '@/lib/theme';

/** 2026-11-06 design §7.5: "Hamısı" exists only for assignments.view holders whose scope is wider than their own. */
export function canSeeAllReports(me: { permissions: Me['permissions']; role: Pick<Me['role'], 'dataScope'> }): boolean {
  return me.permissions.includes('assignments.view') && me.role.dataScope !== 'own';
}

/** The state chip's tone, following the tasks' tones. */
export const STATE_TONES: Record<ProblemReportState, Tone> = { open: 'neutral', task_assigned: 'active', resolved: 'success', closed: 'neutral' };

/** The "Hamısı" filter chips, in display order; `active` is the default. */
export const REPORT_FILTERS = ['active', 'resolved', 'closed'] as const;
export type ReportFilter = (typeof REPORT_FILTERS)[number];
