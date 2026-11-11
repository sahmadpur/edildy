import { Injectable } from '@nestjs/common';
import {
  addDays,
  CALENDAR_MAX_ITEMS,
  COMPLETED_STATUSES,
  type CalendarItem,
  type CalendarResponse,
  expandSchedule,
  localDateOf,
  type OccurrenceStatus,
  recurrenceSchema,
  timingSchema,
} from '@taskop/contracts';
import { and, asc, between, eq, inArray, ne, or, type SQL, sql } from 'drizzle-orm';
import { Clock } from '../common/clock';
import { inSiteSubtrees, sqlList } from '../common/sql';
import { DbService } from '../db/db.service';
import { assignments, checklists, occurrences, sites } from '../db/schema';
import type { Actor } from './actor';
import type { CalendarQueryDto } from './dto';
import { toOccurrenceDto } from './mappers';
import { OccurrenceQueries } from './occurrence-queries';
import { OccurrenceWriter } from './occurrence-writer';
import { SchedulingScope } from './scheduling-scope';

/**
 * The "Yoxlama cədvəli" month view (feedback 2026-11-08): stored runs in the range, plus the checks active assignments
 * will create after their generated horizon (`materialized_until`), worked out from the schedule like the writer does.
 */
@Injectable()
export class OccurrenceCalendar {
  constructor(
    private readonly db: DbService,
    private readonly clock: Clock,
    private readonly scope: SchedulingScope,
    private readonly queries: OccurrenceQueries,
    private readonly writer: OccurrenceWriter,
  ) {}

  async list(a: Actor, q: CalendarQueryDto): Promise<CalendarResponse> {
    const statuses = q.status ?? null;
    const runStatuses = statuses?.filter((s): s is OccurrenceStatus => s !== 'planned') ?? null;
    const wantPlanned = !statuses || statuses.includes('planned');
    const items: CalendarItem[] = [];
    let truncated = false;

    if (!runStatuses || runStatuses.length) {
      const conds: (SQL | undefined)[] = [this.scope.occurrences(a), between(occurrences.localDate, q.from, q.to)];
      if (q.siteId) conds.push(inSiteSubtrees(occurrences.siteId, q.siteId));
      if (q.checklistId) conds.push(inArray(occurrences.checklistId, q.checklistId));
      if (q.assigneeId) conds.push(sql`exists (select 1 from occurrence_assignees oa where oa.occurrence_id = ${occurrences.id} and oa.user_id in ${sqlList(q.assigneeId)})`);
      if (runStatuses) conds.push(inArray(occurrences.status, runStatuses));
      // Cancelled yoxlamalar leave the calendar (feedback 2026-11-11, item 1): cancelled runs show only when asked for, and
      // a cancelled (ended) assignment or deactivated checklist keeps only the runs that were actually done.
      else conds.push(ne(occurrences.status, 'cancelled'));
      conds.push(or(and(ne(assignments.status, 'ended'), eq(checklists.status, 'active')), inArray(occurrences.status, [...COMPLETED_STATUSES])));
      const rows = await this.queries
        .select()
        .where(and(...conds))
        .orderBy(asc(occurrences.startsAt), asc(occurrences.id))
        .limit(CALENDAR_MAX_ITEMS + 1);
      if (rows.length > CALENDAR_MAX_ITEMS) truncated = true;
      const runs = rows.slice(0, CALENDAR_MAX_ITEMS).map(toOccurrenceDto);
      const names = await this.userNames([...new Set(runs.flatMap((r) => r.assigneeIds))]);
      for (const r of runs) {
        items.push({
          kind: 'run',
          occurrenceId: r.id,
          assignmentId: r.assignmentId,
          assignmentName: r.assignmentName,
          checklistId: r.checklistId,
          checklistName: r.checklistName,
          siteId: r.siteId,
          siteName: r.siteName,
          shiftName: r.shiftName,
          localDate: r.localDate,
          startsAt: r.startsAt,
          dueAt: r.dueAt,
          status: r.status,
          assigneeNames: r.assigneeIds.map((id) => names.get(id)).filter((n): n is string => Boolean(n)),
          executionBrief: r.executionBrief,
        });
      }
    }

    if (wantPlanned && !truncated) items.push(...(await this.planned(a, q, CALENDAR_MAX_ITEMS - items.length)));
    if (items.length >= CALENDAR_MAX_ITEMS) truncated = true;
    items.sort((x, y) => (x.startsAt < y.startsAt ? -1 : x.startsAt > y.startsAt ? 1 : 0));
    return { items: items.slice(0, CALENDAR_MAX_ITEMS), truncated };
  }

  /** Slots of active assignments that start at or after their generated horizon and fall in the range. */
  private async planned(a: Actor, q: CalendarQueryDto, room: number): Promise<CalendarItem[]> {
    if (room <= 0) return [];
    const conds: (SQL | undefined)[] = [this.scope.assignments(a), eq(assignments.status, 'active'), eq(checklists.status, 'active')];
    if (q.siteId) conds.push(inSiteSubtrees(assignments.siteId, q.siteId));
    if (q.checklistId) conds.push(inArray(assignments.checklistId, q.checklistId));
    if (q.assigneeId) conds.push(sql`exists (select 1 from assignment_assignees aa where aa.assignment_id = ${assignments.id} and aa.user_id in ${sqlList(q.assigneeId)})`);
    const rows = await this.db
      .tx()
      .select({
        id: assignments.id,
        name: assignments.name,
        checklistId: assignments.checklistId,
        checklistName: checklists.name,
        siteId: assignments.siteId,
        siteName: sites.name,
        schedule: assignments.schedule,
        timing: assignments.timing,
        materializedUntil: assignments.materializedUntil,
        assigneeNames: sql<string[]>`array(select u.full_name from assignment_assignees aa join users u on u.id = aa.user_id
          where aa.assignment_id = "assignments"."id" and u.status = 'active' order by u.full_name)`,
        shiftName: sql<string | null>`(select s.name from shifts s where s.id = "assignments"."shift_id")`,
      })
      .from(assignments)
      .innerJoin(checklists, eq(checklists.id, assignments.checklistId))
      .innerJoin(sites, eq(sites.id, assignments.siteId))
      .where(and(...conds))
      .orderBy(asc(assignments.id));
    if (!rows.length) return [];
    const tz = await this.writer.tenantTimezone();
    const now = this.clock.now();
    const out: CalendarItem[] = [];
    for (const r of rows) {
      const timing = timingSchema.parse(r.timing);
      const shift = timing.mode === 'shift' ? await this.writer.shiftHours(timing.shiftId) : null;
      if (timing.mode === 'shift' && !shift) continue;
      // Nothing before the generated horizon: those days already have (or deliberately lack) stored runs.
      const horizon = r.materializedUntil ?? now;
      const from = localDateOf(horizon, tz) > q.from ? localDateOf(horizon, tz) : q.from;
      if (from > q.to) continue;
      const slots = expandSchedule(recurrenceSchema.parse(r.schedule), timing, shift, tz, addDays(from, -1), q.to).filter(
        (s) => s.startsAt >= horizon && s.closesAt > now && s.localDate >= q.from && s.localDate <= q.to,
      );
      for (const s of slots) {
        out.push({
          kind: 'planned',
          occurrenceId: null,
          assignmentId: r.id,
          assignmentName: r.name,
          checklistId: r.checklistId,
          checklistName: r.checklistName,
          siteId: r.siteId,
          siteName: r.siteName,
          shiftName: r.shiftName,
          localDate: s.localDate,
          startsAt: s.startsAt.toISOString(),
          dueAt: s.dueAt.toISOString(),
          status: 'planned',
          assigneeNames: r.assigneeNames,
          executionBrief: null,
        });
        if (out.length >= room) return out;
      }
    }
    return out;
  }

  private async userNames(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const rows = await this.db.tx().execute<{ id: string; full_name: string }>(sql`select id::text, full_name from users where id in ${sqlList(ids)}`);
    return new Map(rows.rows.map((r) => [r.id, r.full_name]));
  }
}
