import type { NotificationType } from '@edildy/contracts';

/** notification_events.payload holds ids only (spec §5), except for manual messages. */
export interface OccurrencePayload {
  occurrenceId: string;
}

export interface AssignedPayload {
  assignmentId: string;
  addedUserIds: string[];
}

export interface ProblemPayload {
  problemId: string;
  occurrenceId: string;
}

/** 2026-11-06 design §6.4. */
export interface ProblemReportPayload {
  reportId: string;
}

export interface TaskPayload {
  taskId: string;
}

/** SP8: the run, the send-back round, the audit (spec §7.1). checklist.completed carries the run alone. */
export interface RunPayload {
  occurrenceId: string;
  executionId: string;
  round?: number;
  auditId?: string;
}

/** The message as sent; recipients are expanded from the ids at fan-out (Spec decision 12). */
export interface ManualPayload {
  title: string;
  body: string;
  userIds: string[];
  teamIds: string[];
  siteIds: string[];
  email: boolean;
}

export interface PayloadOf extends Record<NotificationType, object> {
  'checklist.assigned': AssignedPayload;
  'checklist.available': OccurrencePayload;
  'checklist.due_soon': OccurrencePayload;
  'checklist.overdue': OccurrencePayload;
  'checklist.missed': OccurrencePayload;
  'checklist.completed': RunPayload;
  'problem.recorded': ProblemPayload;
  'problem.critical': ProblemPayload;
  'problem_report.created': ProblemReportPayload;
  'problem_report.critical': ProblemReportPayload;
  'problem_report.closed': ProblemReportPayload;
  'problem_report.resolved': ProblemReportPayload;
  'task.assigned': TaskPayload;
  'task.submitted': TaskPayload;
  'task.rejected': TaskPayload;
  'task.completed': TaskPayload;
  'task.overdue': TaskPayload;
  'task.cancelled': TaskPayload;
  'run.correction_required': RunPayload;
  'run.resubmitted': RunPayload;
  'audit.finished': RunPayload;
  manual: ManualPayload;
}
