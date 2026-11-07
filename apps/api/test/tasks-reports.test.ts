import type { TaskDetail } from '@taskop/contracts';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './app';
import { FakeClock } from './fake-clock';
import { captureReportEvents, createReport, newReportBody, reportWorld } from './problem-report-fixtures';
import { MONDAY_0800 } from './scheduling-fixtures';
import { act, createTask, newTaskBody } from './task-fixtures';

/** 2026-11-06 design §6.2: tasks created from problem reports. */
describe('tasks from problem reports', () => {
  const clock = new FakeClock(MONDAY_0800);
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({}, { clock });
  });
  afterAll(() => t.close());

  it('creates a task from a report: site from the report, title and instructions from its text, review on', async () => {
    const w = await reportWorld(t);
    const r = await createReport(w.workers[0].api, newReportBody(w.siteId, { severity: 'critical', text: 'Anbarın qapısı bağlanmır, kilid sınıb' }));
    const task = await createTask(w.managerHere.api, { id: uuidv7(), assignee: { userId: w.workers[0].id }, problemReportId: r.id, siteId: w.otherSiteId });
    // On the wire the source stays within the old enum (older phones must keep parsing /me/sync); clients derive the badge from problemReportId.
    expect(task).toMatchObject({ title: r.text, instructions: r.text, requiresReview: true, source: 'adhoc', problemReportId: r.id, problemId: null, site: { id: w.siteId } });
    expect(task.problemReport).toMatchObject({ id: r.id, text: r.text, severity: 'critical' });
    expect(task.problem).toBeNull();
    // An explicit title and instructions win.
    const r2 = await createReport(w.workers[0].api, newReportBody(w.siteId));
    const task2 = await createTask(w.managerHere.api, newTaskBody({ userId: w.workers[0].id }, { problemReportId: r2.id, requiresReview: false }));
    expect(task2).toMatchObject({ title: 'Soyuducunun qapısını təmir edin', instructions: 'Qapının rezinini dəyişin.', requiresReview: false });
    // The report now shows the task.
    const shown = await w.managerHere.api.get(`/api/v1/problem-reports/${r2.id}`);
    expect(shown.body).toMatchObject({ state: 'task_assigned', taskId: task2.id, taskStatus: 'new' });
    // The list filter by source.
    const list = await w.managerHere.api.get('/api/v1/tasks?source=report');
    expect((list.body.items as TaskDetail[]).map((x) => x.id).sort()).toEqual([task.id, task2.id].sort());
  });

  it('refuses a second active task (PROBLEM_REPORT_HAS_TASK) but allows one after the first was cancelled', async () => {
    const w = await reportWorld(t);
    const r = await createReport(w.workers[0].api, newReportBody(w.siteId));
    const first = await createTask(w.managerHere.api, newTaskBody({ userId: w.workers[0].id }, { problemReportId: r.id }));
    const dup = await w.managerHere.api.post('/api/v1/tasks', newTaskBody({ userId: w.workers[0].id }, { problemReportId: r.id }));
    expect([dup.status, dup.body.error.code]).toEqual([409, 'PROBLEM_REPORT_HAS_TASK']);
    expect((await w.managerHere.api.post(`/api/v1/tasks/${first.id}/cancel`, { reason: 'Səhv' })).status).toBe(200);
    expect((await w.managerHere.api.get(`/api/v1/problem-reports/${r.id}`)).body.state).toBe('open');
    await createTask(w.managerHere.api, newTaskBody({ userId: w.workers[0].id }, { problemReportId: r.id }));
  });

  it('refuses a closed report (PROBLEM_REPORT_CLOSED), a report out of scope (404) and both sources at once (400)', async () => {
    const w = await reportWorld(t);
    const r = await createReport(w.workers[0].api, newReportBody(w.siteId));
    const away = await w.managerThere.api.post('/api/v1/tasks', newTaskBody({ userId: w.workers[1].id }, { problemReportId: r.id }));
    expect(away.status).toBe(404);
    expect((await w.managerHere.api.post(`/api/v1/problem-reports/${r.id}/close`, { comment: 'Bağlandı' })).status).toBe(200);
    const closed = await w.managerHere.api.post('/api/v1/tasks', newTaskBody({ userId: w.workers[0].id }, { problemReportId: r.id }));
    expect([closed.status, closed.body.error.code]).toEqual([409, 'PROBLEM_REPORT_CLOSED']);
    const both = await w.managerHere.api.post('/api/v1/tasks', newTaskBody({ userId: w.workers[0].id }, { problemReportId: r.id, problemId: r.id }));
    expect(both.status).toBe(400);
  });

  it('the report becomes resolved when the task completes, and problem_report.resolved names the reporter', async () => {
    const w = await reportWorld(t);
    const r = await createReport(w.workers[0].api, newReportBody(w.siteId));
    const task = await createTask(w.managerHere.api, newTaskBody({ userId: w.workers[0].id }, { problemReportId: r.id, requiresReview: false }));
    const cap = captureReportEvents(t);
    try {
      expect((await act(w.workers[0].api, task.id, 'start', '2026-11-02T03:50:00.000Z')).status).toBe(200);
      const done = await w.workers[0].api.post(`/api/v1/tasks/${task.id}/submissions`, { id: uuidv7(), text: 'Düzəldildi', mediaIds: [], submittedAt: '2026-11-02T03:55:00.000Z' });
      expect(done.status, JSON.stringify(done.body)).toBe(200);
      expect(done.body.status).toBe('completed');
      expect((await w.workers[0].api.get(`/api/v1/problem-reports/${r.id}`)).body).toMatchObject({ state: 'resolved', taskStatus: 'completed' });
      expect(cap.seen).toEqual([['problem_report.resolved', r.id, w.workers[0].id]]);
    } finally {
      cap.stop();
    }
  });

  it('task readers get the report card, and a worker sees the task from their own report on the phone', async () => {
    const w = await reportWorld(t);
    const r = await createReport(w.workers[0].api, newReportBody(w.siteId));
    // The admin (all) may assign the site-2 worker; a site-1 manager could not (TASK_ASSIGNEE_INVALID).
    const task = await createTask(w.admin.api, newTaskBody({ userId: w.workers[1].id }, { problemReportId: r.id }));
    // Worker 2 is the assignee: reads the task and its report card although the report is not theirs.
    const seen = await w.workers[1].api.get(`/api/v1/tasks/${task.id}`);
    expect(seen.status).toBe(200);
    expect(seen.body.problemReport).toMatchObject({ id: r.id, reporter: { id: w.workers[0].id } });
  });
});
