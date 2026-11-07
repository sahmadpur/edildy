import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './app';
import { FakeClock } from './fake-clock';
import { eventRows, fanOutAll, inboxOf } from './notification-fixtures';
import { createReport, newReportBody, reportWorld } from './problem-report-fixtures';
import { MONDAY_0800 } from './scheduling-fixtures';
import { act, createTask, newTaskBody } from './task-fixtures';

/** 2026-11-06 design §6.4: managers in scope learn of a report; the reporter learns of its close and resolution. */
describe('problem report notifications', () => {
  const clock = new FakeClock(MONDAY_0800);
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({}, { clock });
  });
  beforeEach(() => clock.set(MONDAY_0800));
  afterAll(() => t.close());

  it('a report reaches the managers whose sites cover it, the admins and the owner; a critical one by email too', async () => {
    const w = await reportWorld(t);
    const r = await createReport(w.workers[0].api, newReportBody(w.siteId));
    expect(await fanOutAll(t, w.s.tenantId)).toEqual(['fanned_out']);
    expect(await inboxOf(w.managerHere.id)).toEqual([
      expect.objectContaining({ type: 'problem_report.created', title: 'Yeni problem bildirildi', body: 'Filial 1 — İşçi 1', target_kind: 'problem_report', target_id: r.id, target_date: null }),
    ]);
    expect(await inboxOf(w.managerThere.id)).toEqual([]);
    expect((await inboxOf(w.admin.id)).map((n) => n.type)).toEqual(['problem_report.created']);
    expect((await inboxOf(w.s.ownerId)).map((n) => n.type)).toEqual(['problem_report.created']);
    expect(await inboxOf(w.workers[0].id)).toEqual([]);
    const critical = await createReport(w.workers[1].api, newReportBody(w.otherSiteId, { severity: 'critical', text: 'Yanğın!' }));
    expect(await fanOutAll(t, w.s.tenantId)).toEqual(['fanned_out']);
    expect(await inboxOf(w.managerThere.id)).toEqual([expect.objectContaining({ type: 'problem_report.critical', title: 'Kritik problem bildirildi!', target_id: critical.id })]);
    expect((await inboxOf(w.admin.id)).map((n) => n.type)).toEqual(['problem_report.created', 'problem_report.critical']);
    expect((await inboxOf(w.s.ownerId)).map((n) => n.type)).toEqual(['problem_report.created', 'problem_report.critical']);
    expect((await eventRows(w.s.tenantId)).map((e) => e.type)).toEqual(['problem_report.created', 'problem_report.critical']);
  });

  it('closing tells the reporter, not the manager who closed it', async () => {
    const w = await reportWorld(t);
    const closed = await createReport(w.workers[0].api, newReportBody(w.siteId));
    expect((await w.managerHere.api.post(`/api/v1/problem-reports/${closed.id}/close`, { comment: 'Yerində düzəldildi' })).status).toBe(200);
    await fanOutAll(t, w.s.tenantId);
    const inbox = await inboxOf(w.workers[0].id);
    expect(inbox.map((n) => n.type)).toEqual(['problem_report.closed']);
    expect(inbox[0]).toMatchObject({ title: 'Probleminiz bağlandı', body: 'Filial 1: Yerində düzəldildi', target_kind: 'problem_report', target_id: closed.id });
    expect((await inboxOf(w.managerHere.id)).map((n) => n.type)).toEqual(['problem_report.created']);
  });

  it('resolving a report through its task tells the reporter; the actor of the completion is never told', async () => {
    const w = await reportWorld(t);
    const r = await createReport(w.workers[0].api, newReportBody(w.siteId));
    // The admin assigns the site-2 worker, so the reporter is not the one who completes it.
    const task = await createTask(w.admin.api, newTaskBody({ userId: w.workers[1].id }, { problemReportId: r.id, requiresReview: false }));
    await fanOutAll(t, w.s.tenantId);
    expect((await act(w.workers[1].api, task.id, 'start', '2026-11-02T03:50:00.000Z')).status).toBe(200);
    expect((await w.workers[1].api.post(`/api/v1/tasks/${task.id}/submissions`, { id: uuidv7(), submittedAt: '2026-11-02T03:55:00.000Z' })).body.status).toBe('completed');
    await fanOutAll(t, w.s.tenantId);
    expect((await inboxOf(w.workers[0].id)).map((n) => [n.type, n.target_id])).toEqual([['problem_report.resolved', r.id]]);
    expect((await inboxOf(w.workers[1].id)).map((n) => n.type)).toEqual(['task.assigned']);
    expect((await eventRows(w.s.tenantId)).map((e) => e.type)).toEqual(['problem_report.created', 'task.assigned', 'task.completed', 'problem_report.resolved']);
  });
});
