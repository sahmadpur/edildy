import { PROBLEM_REPORT_STATE_FILTERS, type ProblemReportState, type ProblemReportStateFilter } from '@edildy/contracts';
import type { Variant } from '@/features/scheduling/labels';

/** Google Maps at the reported point (2026-11-06 design §8). */
export const mapsLink = (lat: number, lng: number): string => `https://www.google.com/maps?q=${lat},${lng}`;

export const reportStateVariant = (s: ProblemReportState): Variant => (s === 'resolved' ? 'default' : s === 'open' ? 'warning' : s === 'task_assigned' ? 'secondary' : 'outline');

/** The state filter's options, `active` first (the default). */
export const REPORT_STATE_FILTERS: readonly ProblemReportStateFilter[] = ['active', ...PROBLEM_REPORT_STATE_FILTERS.filter((f) => f !== 'active')];
