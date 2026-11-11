import { Injectable } from '@nestjs/common';
import { localDateOf, PROBLEM_REPORT_LIMITS } from '@edildy/contracts';
import { and, eq, or, type SQL, sql } from 'drizzle-orm';
import { AppError } from '../common/app-error';
import { Clock } from '../common/clock';
import type { Principal, TaskReader } from '../common/request';
import { DbService } from '../db/db.service';
import { problemReports, sites } from '../db/schema';
import { chain, inSubtree, SchedulingScope } from '../scheduling/scheduling-scope';

export type ProblemReportRow = typeof problemReports.$inferSelect;

const DAY = 86_400_000;

/** 2026-11-06 design §6.1 as SQL over `problem_reports` and `sites`. Unknown scopes fail closed. */
@Injectable()
export class ProblemReportScope {
  constructor(
    private readonly db: DbService,
    private readonly clock: Clock,
    private readonly scheduling: SchedulingScope,
  ) {}

  /** The reporter always; holders of assignments.view also everything their data scope covers. */
  readable(p: TaskReader): SQL {
    const mine = eq(problemReports.reporterUserId, p.userId);
    if (!p.permissions.has('assignments.view')) return mine;
    switch (p.dataScope) {
      case 'all':
        return sql`true`;
      case 'site_subtree':
        return or(mine, inSubtree(p.userId, problemReports.siteId))!;
      case 'subordinates':
        return or(mine, sql`${problemReports.reporterUserId} in ${chain(p.userId)}`)!;
      case 'own':
        return mine;
      default: {
        const unhandled: never = p.dataScope;
        throw new Error(`Unhandled data scope: ${String(unhandled)}`);
      }
    }
  }

  /** Close and task-from-report: tasks.manage over a readable report. */
  manageable(p: Principal): SQL {
    return p.permissions.has('tasks.manage') ? this.readable(p) : sql`false`;
  }

  /**
   * The sites a user may report at, as SQL over `sites`: wide scopes read their sites; narrow scopes the user's own
   * `user_sites` plus the sites of checklists assigned to them around today (user_sites is optional, see §6.1).
   */
  reportableSites(p: TaskReader): SQL {
    if (p.dataScope === 'all' || p.dataScope === 'site_subtree') return this.scheduling.readableSites(p);
    const now = this.clock.now();
    // UTC day bounds are a day off the tenant's at most: harmless for a 90-day window.
    const from = localDateOf(new Date(+now - PROBLEM_REPORT_LIMITS.reportableOccurrencePastDays * DAY), 'UTC');
    const to = localDateOf(new Date(+now + PROBLEM_REPORT_LIMITS.reportableOccurrenceFutureDays * DAY), 'UTC');
    return or(
      sql`exists (select 1 from user_sites us where us.user_id = ${p.userId} and us.site_id = ${sites.id})`,
      sql`exists (select 1 from occurrence_assignees oa join occurrences o on o.id = oa.occurrence_id
            where oa.user_id = ${p.userId} and o.site_id = ${sites.id} and o.local_date between ${from} and ${to})`,
    )!;
  }

  async access(p: Principal, id: string): Promise<{ canRead: boolean; canManage: boolean }> {
    const [r] = await this.db
      .tx()
      .select({
        canRead: sql<boolean>`coalesce((${this.readable(p)}), false)`,
        canManage: sql<boolean>`coalesce((${this.manageable(p)}), false)`,
      })
      .from(problemReports)
      .where(eq(problemReports.id, id));
    return r ?? { canRead: false, canManage: false };
  }

  /** Locks the row first, so a close decides on the committed state. */
  async lock(id: string): Promise<ProblemReportRow> {
    const [r] = await this.db.tx().select().from(problemReports).where(eq(problemReports.id, id)).for('update');
    if (!r) throw new AppError('NOT_FOUND');
    return r;
  }

  /** The site exists, is active and is one the user may report at. */
  async assertReportable(p: TaskReader, siteId: string): Promise<void> {
    const tx = this.db.tx();
    const [site] = await tx.select({ active: sites.active }).from(sites).where(eq(sites.id, siteId));
    if (!site) throw new AppError('REFERENCE_NOT_FOUND', { fields: { siteId: 'errors.REFERENCE_NOT_FOUND' } });
    if (!site.active) throw new AppError('SITE_INACTIVE');
    const [ok] = await tx.select({ id: sites.id }).from(sites).where(and(eq(sites.id, siteId), this.reportableSites(p)));
    if (!ok) throw new AppError('SITE_NOT_ALLOWED');
  }
}
