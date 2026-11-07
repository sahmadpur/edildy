import { z } from 'zod';
import { cursorQuerySchema, idSchema, isoDateTimeSchema } from './common.js';
import { problemSeveritySchema } from './execution-logic.js';
import { problemMediaRefSchema } from './execution-views.js';
import { MEDIA_LIMITS } from './executions.js';
import { userRefSchema } from './occurrences.js';
import { localDateSchema } from './scheduling-time.js';
import { taskMediaRegisterSchema, type TaskStatus, taskStatusSchema } from './tasks.js';

/**
 * Standalone problems a worker reports from the phone (design 2026-11-06 §3–§4): text, severity, photos or videos, a site
 * and the GPS position when the phone had one. Separate from the checklist problems of `execution_problems`.
 */

/** Spec §3. `closed` is stored; the other three are derived from the report's task. */
export const PROBLEM_REPORT_STATES = ['open', 'task_assigned', 'resolved', 'closed'] as const;
export const problemReportStateSchema = z.enum(PROBLEM_REPORT_STATES);
export type ProblemReportState = z.infer<typeof problemReportStateSchema>;

/** `active` = open + task_assigned, the list's default. */
export const PROBLEM_REPORT_STATE_FILTERS = [...PROBLEM_REPORT_STATES, 'active'] as const;
export const problemReportStateFilterSchema = z.enum(PROBLEM_REPORT_STATE_FILTERS);
export type ProblemReportStateFilter = z.infer<typeof problemReportStateFilterSchema>;

export const PROBLEM_REPORT_LIMITS = {
  textMax: 2000,
  closeCommentMax: 1000,
  maxMedia: MEDIA_LIMITS.problemMaxMedia,
  /** The reporter's own reports stay on the phone this long after creation, plus any still open (spec §6.3). */
  syncDays: 30,
  /** Known report ids the phone sends to /me/sync. */
  knownIds: 100,
  /** A worker may report at the sites of their checklists in this window around today (spec §6.1). */
  reportableOccurrencePastDays: 90,
  reportableOccurrenceFutureDays: 30,
} as const;

export const problemReportLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).nullable(),
  capturedAt: isoDateTimeSchema,
});
export type ProblemReportLocation = z.infer<typeof problemReportLocationSchema>;

export const createProblemReportSchema = z.object({
  /** Client-generated UUIDv7: repeating the request returns the stored report. */
  id: idSchema,
  siteId: idSchema,
  severity: problemSeveritySchema,
  text: z.string().trim().min(1).max(PROBLEM_REPORT_LIMITS.textMax),
  /** Null when the phone could not get a fix (owner's decision: lenient). */
  location: problemReportLocationSchema.nullable(),
  /** Device time of the send; the API clamps it like task times. */
  reportedAt: isoDateTimeSchema,
});
export type CreateProblemReportInput = z.input<typeof createProblemReportSchema>;

export const closeProblemReportSchema = z.object({ comment: z.string().trim().min(1).max(PROBLEM_REPORT_LIMITS.closeCommentMax) });
export type CloseProblemReportInput = z.input<typeof closeProblemReportSchema>;

export const problemReportMediaRegisterSchema = taskMediaRegisterSchema.omit({ role: true });
export type ProblemReportMediaRegisterInput = z.input<typeof problemReportMediaRegisterSchema>;

export const problemReportDtoSchema = z.object({
  id: idSchema,
  siteId: idSchema,
  siteName: z.string(),
  severity: problemSeveritySchema,
  text: z.string(),
  location: problemReportLocationSchema.nullable(),
  reportedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  reporter: userRefSchema,
  /** In capture order, with kind and upload status (like a checklist problem's media). */
  media: z.array(problemMediaRefSchema),
  state: problemReportStateSchema,
  /** The active (non-cancelled) task made from the report, if any. */
  taskId: idSchema.nullable(),
  taskStatus: taskStatusSchema.nullable(),
  closedAt: isoDateTimeSchema.nullable(),
  closedBy: userRefSchema.nullable(),
  closeComment: z.string().nullable(),
});
export type ProblemReportDto = z.infer<typeof problemReportDtoSchema>;

export const problemReportListQuerySchema = cursorQuerySchema.extend({
  state: problemReportStateFilterSchema.default('active'),
  siteId: idSchema.optional(),
  /** Tenant-local dates on reported_at. */
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
});
export type ProblemReportListQuery = z.input<typeof problemReportListQuerySchema>;

/** A site the caller may report at (GET /problem-reports/sites and /me/sync). */
export const reportSiteSchema = z.object({ id: idSchema, name: z.string() });
export type ReportSite = z.infer<typeof reportSiteSchema>;

/** Spec §3: closed wins; a completed task resolves; any other non-cancelled task means a task is assigned; else open. */
export function problemReportState(report: { closedAt: string | Date | null }, task: { status: TaskStatus } | null): ProblemReportState {
  if (report.closedAt !== null) return 'closed';
  if (task === null || task.status === 'cancelled') return 'open';
  if (task.status === 'completed') return 'resolved';
  return 'task_assigned';
}
