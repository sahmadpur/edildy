import { Injectable } from '@nestjs/common';
import type { Page, ProblemReportDto, ReportSite } from '@taskop/contracts';
import { and, asc, desc, eq, inArray, type SQL, sql } from 'drizzle-orm';
import { AppError } from '../common/app-error';
import { inSiteSubtrees } from '../common/sql';
import type { Principal, TaskReader } from '../common/request';
import { DbService } from '../db/db.service';
import { problemReports, sites } from '../db/schema';
import type { ProblemReportListQueryDto } from './dto';
import { reportedOn, selectProblemReports, stateFilter, toProblemReportDtos } from './problem-report-rows';
import { ProblemReportScope } from './problem-report-scope';

/** GET /problem-reports, GET /problem-reports/:id, the phone's copies and the task cards (2026-11-06 design §6.2). */
@Injectable()
export class ProblemReportQueries {
  constructor(
    private readonly db: DbService,
    private readonly scope: ProblemReportScope,
  ) {}

  /** Readable reports only, newest first, keyset on (created_at, id). */
  async list(p: Principal, q: ProblemReportListQueryDto): Promise<Page<ProblemReportDto>> {
    const conds: (SQL | undefined)[] = [this.scope.readable(p), stateFilter(q.state)];
    if (q.siteId) conds.push(inSiteSubtrees(problemReports.siteId, q.siteId));
    if (q.from) conds.push(reportedOn('>=', q.from));
    if (q.to) conds.push(reportedOn('<=', q.to));
    if (q.cursor) conds.push(sql`(${problemReports.createdAt}, ${problemReports.id}) < (select c.created_at, c.id from problem_reports c where c.id = ${q.cursor})`);
    const tx = this.db.tx();
    const rows = await selectProblemReports(tx)
      .where(and(...conds))
      .orderBy(desc(problemReports.createdAt), desc(problemReports.id))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    return { items: await toProblemReportDtos(tx, page), nextCursor: rows.length > q.limit ? page[page.length - 1]!.r.id : null };
  }

  async detail(p: Principal, id: string): Promise<ProblemReportDto> {
    const tx = this.db.tx();
    const rows = await selectProblemReports(tx).where(and(eq(problemReports.id, id), this.scope.readable(p)));
    const [dto] = await toProblemReportDtos(tx, rows);
    if (!dto) throw new AppError('NOT_FOUND');
    return dto;
  }

  /** No access check: for the sync section and task cards, whose callers decided access. Keeps the order of `ids`. */
  async byIds(ids: string[]): Promise<ProblemReportDto[]> {
    if (!ids.length) return [];
    const tx = this.db.tx();
    const dtos = await toProblemReportDtos(tx, await selectProblemReports(tx).where(inArray(problemReports.id, ids)));
    const byId = new Map(dtos.map((d) => [d.id, d]));
    return ids.flatMap((id) => {
      const d = byId.get(id);
      return d ? [d] : [];
    });
  }

  /** Active sites the caller may report at, by name. */
  async sites(p: TaskReader): Promise<ReportSite[]> {
    return this.db
      .tx()
      .select({ id: sites.id, name: sites.name })
      .from(sites)
      .where(and(eq(sites.active, true), this.scope.reportableSites(p)))
      .orderBy(asc(sites.name), asc(sites.id))
      .limit(200);
  }
}
