import { type ProblemReportDto, problemReportState, type ProblemReportStateFilter } from '@taskop/contracts';
import { and, asc, eq, getTableColumns, inArray, isNotNull, isNull, ne, or, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Executor } from '../db/db.service';
import { problemReportMedia, problemReports, sites, tasks, users } from '../db/schema';

const reporter = alias(users, 'reporter');
const closer = alias(users, 'closer');

/** Reports with their site, reporter, closer and the active (non-cancelled) task made from them. */
export function selectProblemReports(tx: Executor) {
  return tx
    .select({
      r: getTableColumns(problemReports),
      siteName: sites.name,
      reporterName: reporter.fullName,
      closedByName: closer.fullName,
      taskId: tasks.id,
      taskStatus: tasks.status,
    })
    .from(problemReports)
    .innerJoin(sites, eq(sites.id, problemReports.siteId))
    .innerJoin(reporter, eq(reporter.id, problemReports.reporterUserId))
    .leftJoin(closer, eq(closer.id, problemReports.closedByUserId))
    .leftJoin(tasks, and(eq(tasks.problemReportId, problemReports.id), ne(tasks.status, 'cancelled')))
    .$dynamic();
}
export type ProblemReportJoinedRow = Awaited<ReturnType<typeof selectProblemReports>>[number];

/** The state filter of GET /problem-reports as SQL over the join above (spec §3). */
export function stateFilter(state: ProblemReportStateFilter): SQL {
  const open = isNull(problemReports.closedAt);
  switch (state) {
    case 'active':
      return and(open, or(isNull(tasks.id), ne(tasks.status, 'completed')))!;
    case 'open':
      return and(open, isNull(tasks.id))!;
    case 'task_assigned':
      return and(open, isNotNull(tasks.id), ne(tasks.status, 'completed'))!;
    case 'resolved':
      return and(open, eq(tasks.status, 'completed'))!;
    case 'closed':
      return isNotNull(problemReports.closedAt);
    default: {
      const unhandled: never = state;
      throw new Error(`Unhandled state filter: ${String(unhandled)}`);
    }
  }
}

/** DTOs for a page of rows, with each report's media (kind and upload status) in capture order. */
export async function toProblemReportDtos(tx: Executor, rows: ProblemReportJoinedRow[]): Promise<ProblemReportDto[]> {
  if (!rows.length) return [];
  const media = await tx
    .select({ id: problemReportMedia.id, reportId: problemReportMedia.reportId, kind: problemReportMedia.kind, status: problemReportMedia.status })
    .from(problemReportMedia)
    .where(inArray(problemReportMedia.reportId, rows.map((x) => x.r.id)))
    .orderBy(asc(problemReportMedia.capturedAt), asc(problemReportMedia.id));
  return rows.map(({ r, siteName, reporterName, closedByName, taskId, taskStatus }) => ({
    id: r.id,
    siteId: r.siteId,
    siteName,
    severity: r.severity,
    text: r.text,
    location: r.lat !== null && r.lng !== null && r.locationAt !== null ? { lat: r.lat, lng: r.lng, accuracyM: r.accuracyM, capturedAt: r.locationAt.toISOString() } : null,
    reportedAt: r.reportedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    reporter: { id: r.reporterUserId, fullName: reporterName },
    media: media.filter((m) => m.reportId === r.id).map((m) => ({ id: m.id, kind: m.kind, status: m.status })),
    state: problemReportState(r, taskStatus ? { status: taskStatus } : null),
    taskId: taskId ?? null,
    taskStatus: taskStatus ?? null,
    closedAt: r.closedAt?.toISOString() ?? null,
    closedBy: r.closedByUserId ? { id: r.closedByUserId, fullName: closedByName ?? '' } : null,
    closeComment: r.closeComment,
  }));
}

/** `(tenant day of reported_at) between from and to`, for the list's date filter; the tenant's zone comes from the row's tenant. */
export const reportedOn = (op: '>=' | '<=', localDate: string): SQL =>
  sql`(${problemReports.reportedAt} at time zone (select timezone from tenants where tenants.id = ${problemReports.tenantId}))::date ${sql.raw(op)} ${localDate}::date`;
