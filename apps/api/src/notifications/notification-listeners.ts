import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { CHECKLIST_REMINDER_TYPES, type NotificationType, type OccurrenceStatus } from '@edildy/contracts';
import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { Clock } from '../common/clock';
import { DomainEvents, type TaskEvent, type TaskEventName } from '../common/domain-events';
import { sanitiseForLog } from '../common/error.filter';
import { DbService, type Tx } from '../db/db.service';
import { executions, pushDevices, tasks, users } from '../db/schema';
import { InboxService } from './inbox.service';
import { NotificationEvents } from './notification-events';

/** task.* events that become notifications of the same name (spec §6.1 step 2). task.accepted is not notified. */
const TASK_TYPES = ['task.assigned', 'task.rejected', 'task.completed', 'task.overdue', 'task.cancelled'] as const satisfies readonly (TaskEventName & NotificationType)[];

/** The occurrence statuses that become notifications. */
function isNotifiedStatus(status: OccurrenceStatus): status is 'overdue' | 'missed' {
  return status === 'overdue' || status === 'missed';
}

/** A run is done with (finished, closed or cancelled): its reminders are cleared for every recipient. */
const DONE_STATUSES: ReadonlySet<OccurrenceStatus> = new Set(['completed', 'audit_pending', 'partial', 'cancelled']);
/** The statuses a finished run lands in. partial counts only when the executor completed it (after the window). */
const FINISHED_STATUSES: ReadonlySet<OccurrenceStatus> = new Set(['completed', 'audit_pending', 'partial']);
/**
 * A run leaving one of these was already finished: an audit starting or being cancelled, a correction cancelled or
 * resubmitted. None of them is a new "check finished".
 */
const AFTER_FINISH_STATUSES: ReadonlySet<OccurrenceStatus> = new Set(['completed', 'audit_pending', 'audited', 'correction_required']);

/** What a status change asks of the listener; null when nothing. */
function occurrenceWork(from: OccurrenceStatus | null, to: OccurrenceStatus) {
  const work = {
    notify: isNotifiedStatus(to) ? to : null,
    clearReminders: DONE_STATUSES.has(to),
    // The resubmit (or a cancelled correction) moves the run out of correction_required: the send-back is dealt with.
    clearCorrection: from === 'correction_required' && to !== 'correction_required',
    finished: FINISHED_STATUSES.has(to) && (from === null || !AFTER_FINISH_STATUSES.has(from)),
  };
  return work.notify || work.clearReminders || work.clearCorrection || work.finished ? work : null;
}
type OccurrenceWork = NonNullable<ReturnType<typeof occurrenceWork>>;

/** 2026-11-07 feedback: a task the executor has handed in (or that is closed) has no open to-dos left for them. */
const EXECUTOR_TODO_TYPES = ['task.assigned', 'task.overdue', 'task.rejected'] as const satisfies readonly NotificationType[];
/** Cleared when each task event happens: the executor's to-dos once it is handed in or closed, the reviewer's once it is reviewed. */
const TASK_CLEARS: Partial<Record<TaskEventName, readonly NotificationType[]>> = {
  'task.submitted': EXECUTOR_TODO_TYPES,
  'task.rejected': ['task.submitted'],
  'task.completed': [...EXECUTOR_TODO_TYPES, 'task.submitted'],
  'task.cancelled': [...EXECUTOR_TODO_TYPES, 'task.submitted'],
};

/** Maps domain events to notification events. Handlers run in the caller's transaction and never throw (NFR-11.01). */
@Injectable()
export class NotificationListeners implements OnModuleInit {
  private readonly logger = new Logger('NotificationListeners');

  constructor(
    private readonly events: DomainEvents,
    private readonly db: DbService,
    private readonly notifications: NotificationEvents,
    private readonly clock: Clock,
    private readonly inbox: InboxService,
  ) {}

  onModuleInit(): void {
    this.events.on('occurrence.status_changed', (e) => {
      // Most status changes need nothing; skip the savepoint round-trip for them.
      const work = occurrenceWork(e.from, e.to);
      if (!work) return Promise.resolve();
      return this.guarded('occurrence.status_changed', (sp) => this.onOccurrence(sp, e.occurrenceId, work));
    });
    this.events.on('assignment.assignees_changed', (e) =>
      this.guarded('assignment.assignees_changed', () => this.notifications.record('checklist.assigned', { assignmentId: e.assignmentId, addedUserIds: e.addedUserIds }, e.actorUserId)),
    );
    this.events.on('problem.recorded', (e) =>
      this.guarded('problem.recorded', () =>
        this.notifications.record(e.severity === 'critical' ? 'problem.critical' : 'problem.recorded', { problemId: e.problemId, occurrenceId: e.occurrenceId }, e.actorUserId, `problem:${e.problemId}`),
      ),
    );
    // 2026-11-06 design §6.4. Dedupe keys make a replayed create or close a no-op.
    this.events.on('problem_report.created', (e) =>
      this.guarded('problem_report.created', () =>
        this.notifications.record(e.severity === 'critical' ? 'problem_report.critical' : 'problem_report.created', { reportId: e.reportId }, e.actorUserId, `problem_report:${e.reportId}`),
      ),
    );
    this.events.on('problem_report.closed', (e) =>
      this.guarded('problem_report.closed', () => this.notifications.record('problem_report.closed', { reportId: e.reportId }, e.actorUserId, `problem_report.closed:${e.reportId}`)),
    );
    this.events.on('problem_report.resolved', (e) =>
      this.guarded('problem_report.resolved', () => this.notifications.record('problem_report.resolved', { reportId: e.reportId }, e.actorUserId)),
    );
    for (const name of TASK_TYPES) this.events.on(name, (e) => this.guarded(name, () => this.notifications.record(name, { taskId: e.taskId }, e.actorUserId)));
    this.events.on('task.submitted', (e) => this.guarded('task.submitted', (sp) => this.onSubmitted(sp, e)));
    for (const [name, types] of Object.entries(TASK_CLEARS) as [TaskEventName, readonly NotificationType[]][]) {
      this.events.on(name, (e) => this.guarded(`${name} (clear)`, (sp) => this.inbox.markReadForTarget({ kind: 'task', id: e.taskId }, types, sp)));
    }
    // SP8 spec §7.1. Dedupe keys make a replayed command's second event a no-op.
    this.events.on('execution.sent_back', (e) =>
      this.guarded('execution.sent_back', () =>
        this.notifications.record('run.correction_required', { occurrenceId: e.occurrenceId, executionId: e.executionId, round: e.round }, e.actorUserId, `run.correction_required:${e.executionId}:${e.round}`),
      ),
    );
    this.events.on('execution.resubmitted', (e) =>
      this.guarded('execution.resubmitted', () =>
        this.notifications.record('run.resubmitted', { occurrenceId: e.occurrenceId, executionId: e.executionId, round: e.round }, e.actorUserId, `run.resubmitted:${e.executionId}:${e.round}`),
      ),
    );
    this.events.on('audit.finished', (e) =>
      this.guarded('audit.finished', () =>
        this.notifications.record('audit.finished', { occurrenceId: e.occurrenceId, executionId: e.executionId, auditId: e.auditId }, e.actorUserId, `audit.finished:${e.auditId}`),
      ),
    );
    this.events.on('user.access_changed', (e) => this.guarded('user.access_changed', (sp) => this.onAccessChanged(sp, e.userId)));
  }

  /**
   * Runs a handler body in a savepoint and swallows its failure: whatever goes wrong here (a read as much as the insert)
   * must never roll back the business change (NFR-11.01).
   */
  private async guarded(event: string, body: (sp: Tx) => Promise<unknown>): Promise<void> {
    try {
      await this.db.tx().transaction((sp) => body(sp));
    } catch (e) {
      this.logger.error(sanitiseForLog(e, null), `Notification listener for ${event} failed; the business change still commits`);
    }
  }

  private async onOccurrence(sp: Tx, occurrenceId: string, work: OccurrenceWork): Promise<void> {
    if (work.notify) {
      // The sweep has no user, so its overdue and missed events have no actor (Spec decision 5).
      const type = work.notify === 'overdue' ? 'checklist.overdue' : 'checklist.missed';
      await this.notifications.record(type, { occurrenceId }, this.db.context().userId, `${type}:${occurrenceId}`);
    }
    const target = { kind: 'occurrence', id: occurrenceId } as const;
    if (work.clearReminders) await this.inbox.markReadForTarget(target, CHECKLIST_REMINDER_TYPES, sp);
    if (work.clearCorrection) await this.inbox.markReadForTarget(target, ['run.correction_required'], sp);
    if (work.finished) await this.onFinished(sp, occurrenceId);
  }

  /**
   * checklist.completed (2026-11-07 feedback), once per run: the completing step and the system's audit_pending step
   * share the dedupe key. A run the sweep closed unfinished (partial, no completed_at) is not finished. The executor is
   * the actor, so they are never told of their own run.
   */
  private async onFinished(sp: Tx, occurrenceId: string): Promise<void> {
    const [x] = await sp
      .select({ id: executions.id, executorUserId: executions.executorUserId })
      .from(executions)
      .where(and(eq(executions.occurrenceId, occurrenceId), ne(executions.state, 'rejected'), isNotNull(executions.completedAt)));
    if (!x) return;
    await this.notifications.record('checklist.completed', { occurrenceId, executionId: x.id }, x.executorUserId, `checklist.completed:${occurrenceId}`);
  }

  /** Spec decision 23: only a submission that waits for review is "submitted"; one straight to completed is told as completed. */
  private async onSubmitted(sp: Tx, e: TaskEvent): Promise<void> {
    const [t] = await sp.select({ status: tasks.status }).from(tasks).where(eq(tasks.id, e.taskId));
    if (t?.status !== 'awaiting_review') return;
    await this.notifications.record('task.submitted', { taskId: e.taskId }, e.actorUserId);
  }

  /**
   * Spec §6.5: a deactivated user's phones stop receiving pushes. Reactivation re-enables nothing; the phone
   * re-registers. Guarded like every handler here, so it can never roll back the deactivation.
   */
  private async onAccessChanged(sp: Tx, userId: string): Promise<void> {
    const [u] = await sp.select({ status: users.status }).from(users).where(eq(users.id, userId));
    if (u?.status !== 'deactivated') return;
    await sp
      .update(pushDevices)
      .set({ disabledAt: this.clock.now() })
      .where(and(eq(pushDevices.userId, userId), isNull(pushDevices.disabledAt)));
  }
}
