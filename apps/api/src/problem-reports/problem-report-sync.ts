import { Injectable } from '@nestjs/common';
import { PROBLEM_REPORT_LIMITS, type ProblemReportDto, type ReportSite } from '@taskop/contracts';
import { and, asc, eq, gte, isNull, ne, or } from 'drizzle-orm';
import type { Principal } from '../common/request';
import { DbService } from '../db/db.service';
import { problemReports, tasks } from '../db/schema';
import { ProblemReportQueries } from './problem-report-queries';

const DAY = 86_400_000;

/** The problem report section of GET /me/sync (2026-11-06 design §6.3): the caller's own reports only. */
@Injectable()
export class ProblemReportSync {
  constructor(
    private readonly db: DbService,
    private readonly queries: ProblemReportQueries,
  ) {}

  /** Own reports created in the last 30 days, plus older ones still open or with a task that is not completed. */
  async forUser(p: Principal, knownIds: string[], now: Date): Promise<{ problemReports: ProblemReportDto[]; removedProblemReportIds: string[]; reportSites: ReportSite[] }> {
    const since = new Date(+now - PROBLEM_REPORT_LIMITS.syncDays * DAY);
    const rows = await this.db
      .tx()
      .select({ id: problemReports.id })
      .from(problemReports)
      .leftJoin(tasks, and(eq(tasks.problemReportId, problemReports.id), ne(tasks.status, 'cancelled')))
      .where(
        and(
          eq(problemReports.reporterUserId, p.userId),
          or(gte(problemReports.createdAt, since), and(isNull(problemReports.closedAt), or(isNull(tasks.id), ne(tasks.status, 'completed')))),
        ),
      )
      .orderBy(asc(problemReports.createdAt), asc(problemReports.id));
    const ids = rows.map((r) => r.id);
    const included = new Set(ids);
    return {
      problemReports: await this.queries.byIds(ids),
      removedProblemReportIds: knownIds.filter((id) => !included.has(id)),
      reportSites: await this.queries.sites(p),
    };
  }
}
