import { Injectable } from '@nestjs/common';
import type { Page, SyncTask, TaskDetail, TaskEvidence, TaskHistoryEntry, TaskSummary } from '@taskop/contracts';
import { and, asc, desc, eq, getTableColumns, gte, inArray, isNotNull, isNull, lte, or, type SQL, sql } from 'drizzle-orm';
import { inSiteSubtrees } from '../common/sql';
import { alias } from 'drizzle-orm/pg-core';
import { AppError } from '../common/app-error';
import type { Principal } from '../common/request';
import { DbService } from '../db/db.service';
import { taskMedia, taskStatusHistory, taskSubmissions, tasks, users } from '../db/schema';
import type { TaskListQueryDto } from './dto';
import { ProblemReportQueries } from '../problem-reports/problem-report-queries';
import { TaskProblems } from './task-problems';
import { iso, selectTasks, toHistoryEntry, toSubmissionDto, toTaskMediaDto, toTaskSummary } from './task-rows';
import { TaskScope } from './task-scope';

const submitter = alias(users, 'submitter');
const reviewer = alias(users, 'reviewer');

/** GET /tasks/:id and the phone's copies (spec §6.2, §6.4). */
@Injectable()
export class TaskQueries {
  constructor(
    private readonly db: DbService,
    private readonly scope: TaskScope,
    private readonly problems: TaskProblems,
    private readonly reports: ProblemReportQueries,
  ) {}

  /** GET /tasks (spec §6.2): readable tasks only, newest first, keyset on (created_at, id). */
  async list(p: Principal, q: TaskListQueryDto): Promise<Page<TaskSummary>> {
    const conds: (SQL | undefined)[] = [this.scope.readable(p)];
    if (q.status) conds.push(inArray(tasks.status, q.status));
    if (q.overdue !== undefined) conds.push(q.overdue ? isNotNull(tasks.overdueAt) : isNull(tasks.overdueAt));
    if (q.siteId) conds.push(inSiteSubtrees(tasks.siteId, q.siteId));
    if (q.assigneeUserId) conds.push(eq(tasks.assigneeUserId, q.assigneeUserId));
    if (q.teamId) conds.push(eq(tasks.assigneeTeamId, q.teamId));
    if (q.createdBy) conds.push(eq(tasks.createdByUserId, q.createdBy));
    if (q.source) conds.push(or(...q.source.map(sourceFilter)));
    if (q.awaitingMyReview) conds.push(eq(tasks.status, 'awaiting_review'), this.scope.reviewable(p));
    if (q.dueFrom) conds.push(gte(tasks.dueAt, new Date(q.dueFrom)));
    if (q.dueTo) conds.push(lte(tasks.dueAt, new Date(q.dueTo)));
    if (q.cursor) conds.push(sql`(${tasks.createdAt}, ${tasks.id}) < (select c.created_at, c.id from tasks c where c.id = ${q.cursor})`);
    const rows = await selectTasks(this.db.tx())
      .where(and(...conds))
      .orderBy(desc(tasks.createdAt), desc(tasks.id))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    return { items: page.map(toTaskSummary), nextCursor: rows.length > q.limit ? page[page.length - 1]!.t.id : null };
  }

  /**
   * `afterManage` is for the response of a manager command that has just changed the task: the actor was authorised
   * before the change, and may no longer read it afterwards (e.g. a reassignment out of their scope). The read gate is
   * skipped; canManage and canReview are still computed for the row as it now is.
   */
  async detail(p: Principal, id: string, opts: { afterManage?: boolean } = {}): Promise<TaskDetail> {
    const access = await this.scope.access(p, id);
    if (!access.canRead && !opts.afterManage) throw new AppError('NOT_FOUND');
    const [task] = await this.syncTasks([id]);
    return { ...task!, history: await this.history(id), canManage: access.canManage, canReview: access.canReview };
  }

  /** Everything but history and rights, batched; the result keeps the order of `ids`. Callers check access. */
  async syncTasks(ids: string[]): Promise<SyncTask[]> {
    if (!ids.length) return [];
    const tx = this.db.tx();
    const rows = await selectTasks(tx).where(inArray(tasks.id, ids));
    const media = await tx
      .select({ m: getTableColumns(taskMedia), capturedByName: users.fullName })
      .from(taskMedia)
      .innerJoin(users, eq(users.id, taskMedia.capturedByUserId))
      .where(inArray(taskMedia.taskId, ids))
      .orderBy(asc(taskMedia.capturedAt), asc(taskMedia.id));
    const submissions = await tx
      .select({ s: getTableColumns(taskSubmissions), submittedByName: submitter.fullName, reviewedByName: reviewer.fullName })
      .from(taskSubmissions)
      .innerJoin(submitter, eq(submitter.id, taskSubmissions.submittedByUserId))
      .leftJoin(reviewer, eq(reviewer.id, taskSubmissions.reviewedByUserId))
      .where(inArray(taskSubmissions.taskId, ids))
      .orderBy(asc(taskSubmissions.receivedAt), asc(taskSubmissions.id));
    const problems = await this.problems.cards(rows.flatMap((r) => (r.t.problemId ? [r.t.problemId] : [])));
    const reports = new Map((await this.reports.byIds(rows.flatMap((r) => (r.t.problemReportId ? [r.t.problemReportId] : [])))).map((d) => [d.id, d]));
    const byId = new Map<string, SyncTask>(
      rows.map((r) => [
        r.t.id,
        {
          ...toTaskSummary(r),
          instructions: r.t.instructions,
          evidence: r.t.evidence as TaskEvidence,
          acceptedAt: iso(r.t.acceptedAt),
          startedAt: iso(r.t.startedAt),
          submittedAt: iso(r.t.submittedAt),
          completedAt: iso(r.t.completedAt),
          cancelledAt: iso(r.t.cancelledAt),
          cancelReason: r.t.cancelReason,
          media: media.filter((m) => m.m.taskId === r.t.id).map(toTaskMediaDto),
          submissions: submissions.filter((s) => s.s.taskId === r.t.id).map(toSubmissionDto),
          problem: r.t.problemId ? (problems.get(r.t.problemId) ?? null) : null,
          problemReport: r.t.problemReportId ? (reports.get(r.t.problemReportId) ?? null) : null,
        },
      ]),
    );
    return ids.flatMap((id) => {
      const task = byId.get(id);
      return task ? [task] : [];
    });
  }

  private async history(taskId: string): Promise<TaskHistoryEntry[]> {
    const rows = await this.db
      .tx()
      .select({ h: getTableColumns(taskStatusHistory), actorName: users.fullName })
      .from(taskStatusHistory)
      .leftJoin(users, eq(users.id, taskStatusHistory.actorUserId))
      .where(eq(taskStatusHistory.taskId, taskId))
      .orderBy(asc(taskStatusHistory.at), asc(taskStatusHistory.id));
    return rows.map(toHistoryEntry);
  }
}

/** The `source` filter: where the task came from. */
function sourceFilter(source: 'problem' | 'report' | 'adhoc'): SQL {
  if (source === 'problem') return isNotNull(tasks.problemId);
  if (source === 'report') return isNotNull(tasks.problemReportId);
  return and(isNull(tasks.problemId), isNull(tasks.problemReportId))!;
}
