import {
  type EmployeeReportRow,
  localDateOf,
  type Me,
  type Period,
  type PeriodPreset,
  type ReportRun,
  resolvePeriod,
  type RunBucket,
} from '@edildy/contracts';
import { hasFeature } from '@/lib/features';

/** Spec §7.1: the Team tab and its routes exist only for reports.view with a data scope wider than `own`. */
export function canSeeTeam(me: { permissions: Me['permissions']; role: Pick<Me['role'], 'dataScope'> }): boolean {
  return me.permissions.includes('reports.view') && me.role.dataScope !== 'own';
}

/** `canSeeTeam` on a plan with reports (BR-01): the Team tab is part of that feature (its employee picker reads /reports/employees, which the API refuses without it). */
export function teamVisible(me: Parameters<typeof canSeeTeam>[0] & Parameters<typeof hasFeature>[0]): boolean {
  return canSeeTeam(me) && hasFeature(me, 'reports');
}

/** The header's period chips (spec §7.1: Bu gün / 7 gün / 30 gün), as Part 1 presets. */
export const TEAM_PERIODS = ['today', 'last_7', 'last_30'] as const satisfies readonly PeriodPreset[];
export type TeamPeriod = (typeof TEAM_PERIODS)[number];

/** A chip's period on the tenant's calendar (decision 2): "today" is the tenant's day, whatever the phone's timezone says. */
export function teamPeriod(preset: TeamPeriod, nowMs: number, tenantTimeZone: string): Period {
  return resolvePeriod(preset, localDateOf(new Date(nowMs), tenantTimeZone));
}

/** The status chips, in display order: the three Göstəricilər and Problemli (feedback 2026-11-15). */
export const TEAM_CHIPS = ['all', 'late', 'planned', 'completed', 'problems'] as const;
export type TeamChip = (typeof TEAM_CHIPS)[number];

/** Each chip lists one /reports/runs bucket (decision 5). */
export const CHIP_BUCKETS: Record<TeamChip, RunBucket> = { all: 'all', late: 'late', planned: 'planned', completed: 'completed', problems: 'problems' };


export interface EmployeeChoice {
  userId: string;
  name: string;
  active: boolean;
}

/**
 * The employee picker's people (decision 6): the period's employee rows without the Unassigned row (a userId filter
 * never matches it, spec §3.3), active people first, each group in the server's name order.
 */
export function employeeChoices(rows: readonly EmployeeReportRow[]): EmployeeChoice[] {
  const people = rows.flatMap((r) => (r.userId === null ? [] : [{ userId: r.userId, name: r.name, active: r.active }]));
  return [...people.filter((p) => p.active), ...people.filter((p) => !p.active)];
}

/** Every loaded page's rows, each run once at its first place (decision 16): a late sync can move a run between pages. */
export function uniqueRuns(pages: readonly { items: readonly ReportRun[] }[]): ReportRun[] {
  const seen = new Set<string>();
  const out: ReportRun[] = [];
  for (const page of pages) {
    for (const run of page.items) {
      if (seen.has(run.occurrenceId)) continue;
      seen.add(run.occurrenceId);
      out.push(run);
    }
  }
  return out;
}
