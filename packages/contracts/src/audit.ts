import { z } from 'zod';
import { clientSchema } from './auth.js';
import { cursorQuerySchema, idSchema, isoDateTimeSchema } from './common.js';

export const auditEntryDtoSchema = z.object({
  id: idSchema,
  actor: z.object({
    type: z.enum(['user', 'platform_admin', 'system']),
    id: idSchema.nullable(),
    name: z.string().nullable(),
  }),
  action: z.string(),
  entityType: z.string(),
  entityId: idSchema.nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  ip: z.string().nullable(),
  /** Which app the caller used: the session's client. Null for jobs and for platform-admin requests. */
  client: clientSchema.nullable(),
  occurredAt: isoDateTimeSchema,
});
export type AuditEntryDto = z.infer<typeof auditEntryDtoSchema>;

export const auditListQuerySchema = cursorQuerySchema.extend({
  actorUserId: idSchema.optional(),
  action: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(50).optional(),
  entityId: idSchema.optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  client: clientSchema.optional(),
});
export type AuditListQuery = z.input<typeof auditListQuerySchema>;

/**
 * Audited task actions, entity type `task`. The manager's actions (spec §6.6) plus the worker's accept, start and submit,
 * so the usage log shows what people do in the mobile app; those also go to task_status_history.
 */
export const TASK_AUDIT_ACTIONS = ['task.created', 'task.updated', 'task.reassigned', 'task.cancelled', 'task.approved', 'task.rejected', 'task.accepted', 'task.started', 'task.submitted'] as const;
export type TaskAuditAction = (typeof TASK_AUDIT_ACTIONS)[number];

/**
 * Audited notification actions (spec §4). `notification_rule.*` use entity type `notification_rule` with a null entity id and
 * `{ type, … }` in before/after; `notification.message_sent` uses entity type `notification_message`, entity id = the event id.
 */
export const NOTIFICATION_AUDIT_ACTIONS = ['notification_rule.updated', 'notification_rule.reset', 'notification.message_sent'] as const;
export type NotificationAuditAction = (typeof NOTIFICATION_AUDIT_ACTIONS)[number];

/**
 * Audited checklist-run actions, entity type `execution`, entity id = the execution id. `execution.started` is written only
 * for the claim that created the run (replays and rejected claims add nothing), `after: { occurrenceId, checklistVersionId,
 * startedAt, late }`; `execution.completed` once per run, `before: { state }`, `after: { state, completedAt, late }` (state is
 * `partial` when the run closed late).
 */
export const EXECUTION_AUDIT_ACTIONS = ['execution.started', 'execution.completed'] as const;
export type ExecutionAuditAction = (typeof EXECUTION_AUDIT_ACTIONS)[number];

/** Audited report action (SP7 spec §5.4): entity type `report`, entity id null, `after: { kind, format, filters, rows }`. */
export const REPORT_AUDIT_ACTIONS = ['reports.exported'] as const;
export type ReportAuditAction = (typeof REPORT_AUDIT_ACTIONS)[number];

/**
 * Audited audit and correction actions (SP8 spec §6.4). `audit.*` use entity type `audit`; `execution.*` entity type
 * `execution`. before/after hold only the changed items. Verdict edits and the system's completed → audit_pending move
 * are recorded only in their own tables and in the status history.
 */
export const AUDIT_FLOW_AUDIT_ACTIONS = [
  'audit.started',
  'audit.finished',
  'audit.cancelled',
  'audit.report_sent',
  'execution.corrected',
  'execution.sent_back',
  'execution.send_back_withdrawn',
  'execution.resubmitted',
] as const;
export type AuditFlowAuditAction = (typeof AUDIT_FLOW_AUDIT_ACTIONS)[number];
