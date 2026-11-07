import { describe, expect, it } from 'vitest';
import {
  createProblemReportSchema,
  createTaskSchema,
  NOTIFICATION_TARGET_KINDS,
  NOTIFICATION_TYPES,
  PROBLEM_REPORT_LIMITS,
  problemReportListQuerySchema,
  problemReportState,
  syncQuerySchema,
  TASK_SOURCE_FILTERS,
  TASK_SOURCES,
  taskListQuerySchema,
  taskSummarySchema,
} from './index.js';

const ID = '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e5f';
const AT = '2026-11-06T08:00:00.000Z';

describe('problemReportState (spec §3)', () => {
  it.each([
    [{ closedAt: '2026-11-06T10:00:00Z' }, { status: 'in_progress' }, 'closed'],
    [{ closedAt: null }, null, 'open'],
    [{ closedAt: null }, { status: 'cancelled' }, 'open'],
    [{ closedAt: null }, { status: 'new' }, 'task_assigned'],
    [{ closedAt: null }, { status: 'awaiting_review' }, 'task_assigned'],
    [{ closedAt: null }, { status: 'completed' }, 'resolved'],
  ] as const)('%j + %j → %s', (r, t, s) => expect(problemReportState(r, t)).toBe(s));
});

describe('problem report schemas (spec §4)', () => {
  it('accepts a report without a location and refuses text over the limit', () => {
    const base = { id: ID, siteId: ID, severity: 'normal', text: 'Su axır', location: null, reportedAt: AT };
    expect(createProblemReportSchema.safeParse(base).success).toBe(true);
    expect(createProblemReportSchema.safeParse({ ...base, text: 'x'.repeat(PROBLEM_REPORT_LIMITS.textMax + 1) }).success).toBe(false);
    expect(createProblemReportSchema.safeParse({ ...base, location: { lat: 40.4, lng: 49.8, accuracyM: 12, capturedAt: AT } }).success).toBe(true);
    expect(createProblemReportSchema.safeParse({ ...base, location: { lat: 91, lng: 49.8, accuracyM: null, capturedAt: AT } }).success).toBe(false);
  });

  it('refuses a task that names both a problem and a report, and allows one without a title from a report', () => {
    const r = createTaskSchema.safeParse({ id: ID, title: 't', assignee: { userId: ID }, problemId: ID, problemReportId: ID });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toBe('tasks.issues.twoSources');
    expect(createTaskSchema.safeParse({ id: ID, assignee: { userId: ID }, problemReportId: ID }).success).toBe(true);
    expect(createTaskSchema.safeParse({ id: ID, assignee: { userId: ID } }).success).toBe(false);
  });

  it('defaults the list state filter to active', () => {
    expect(problemReportListQuerySchema.parse({}).state).toBe('active');
  });

  it('extends the sync query, the task sources and the notification catalogue', () => {
    expect(syncQuerySchema.parse({}).knownProblemReportIds).toEqual([]);
    // The wire enum is unchanged, so phones on older builds keep parsing /me/sync; 'report' exists only as a list filter.
    expect(TASK_SOURCES).toEqual(['problem', 'adhoc']);
    expect(TASK_SOURCE_FILTERS).toEqual(['problem', 'report', 'adhoc']);
    expect(taskListQuerySchema.parse({ source: 'report' }).source).toEqual(['report']);
    expect(taskSummarySchema.shape.source.safeParse('report').success).toBe(false);
    expect(NOTIFICATION_TYPES).toEqual(expect.arrayContaining(['problem_report.created', 'problem_report.critical', 'problem_report.closed', 'problem_report.resolved']));
    expect(NOTIFICATION_TARGET_KINDS).toContain('problem_report');
  });
});
