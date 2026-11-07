import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DbService } from '../src/db/db.service';
import { InboxService } from '../src/notifications/inbox.service';
import { NotificationEvents } from '../src/notifications/notification-events';
import { NotificationJobs } from '../src/notifications/notification-jobs';
import { createTestApp, type TestApp } from './app';
import { auditWorld, resubmit, sendBack } from './audit-fixtures';
import { answersBody, claimOk, completeExecution, executionWorld, fullAnswers, registerPhoto } from './execution-fixtures';
import { FakeClock } from './fake-clock';
import { addDevice, deliveriesOf, eventRows, fanOutAll, inboxOf, staffAt } from './notification-fixtures';
import { MONDAY_0800 } from './scheduling-fixtures';
import { act, createTask, newTaskBody, taskWorld } from './task-fixtures';

const T = (hhmm: string) => `2026-11-02T${hhmm}:00.000Z`;

/** 2026-11-07 feedback: reminders about finished runs and tasks are cleared for everyone; a finished run is announced. */
describe('notification clearing and checklist.completed', () => {
  const clock = new FakeClock(MONDAY_0800);
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({}, { clock });
  });
  beforeEach(() => clock.set(MONDAY_0800));
  afterAll(() => t.close());

  /** [type, read?] of a user's inbox, oldest first. */
  const inboxState = async (userId: string) => (await inboxOf(userId)).map((n) => [n.type, n.read_at !== null]);

  /** Today's run (08:00–10:00 Baku), announced as available at 08:00 and fanned out; İşçi 1 then completes it at 08:20. */
  async function completedRun(beforeCompletion?: (w: Awaited<ReturnType<typeof executionWorld>>) => Promise<void>) {
    const w = await executionWorld(t);
    const manager = await staffAt(t, w.s.tenantId, w.owner, 'manager', [w.siteId], 'Menecer');
    const admin = await staffAt(t, w.s.tenantId, w.owner, 'admin', [], 'Admin');
    expect(await t.app.get(NotificationJobs).scanAll([w.s.tenantId])).toBe(1);
    await fanOutAll(t, w.s.tenantId);
    for (const worker of w.workers) expect(await inboxState(worker.id)).toEqual([['checklist.assigned', false], ['checklist.available', false]]);
    await beforeCompletion?.(w);
    clock.set(T('04:20'));
    const executionId = await claimOk(w.workers[0].api, w.occurrenceId, T('04:10'));
    const photo = await registerPhoto(w.workers[0].api, executionId, w.c.photo.id);
    const res = await completeExecution(w.workers[0].api, executionId, 1, fullAnswers(w, photo), T('04:20'));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return { w, manager, admin, executionId };
  }

  it('marks every assignee’s reminders of a completed run read, and nothing else', async () => {
    const { w } = await completedRun();
    for (const worker of w.workers) expect(await inboxState(worker.id)).toEqual([['checklist.assigned', false], ['checklist.available', true]]);
    const [available] = (await inboxOf(w.workers[1].id)).filter((n) => n.type === 'checklist.available');
    expect(available!.read_at).toEqual(new Date(T('04:20')));
  });

  it('drops a reminder whose fan-out runs after the run was finished', async () => {
    const { w } = await completedRun((x) =>
      t.app.get(DbService).withTenant(x.s.tenantId, null, async () => {
        await t.app.get(NotificationEvents).create('checklist.due_soon', { occurrenceId: x.occurrenceId }, null);
      }),
    );
    // due_soon (recorded before completion), then checklist.completed.
    expect(await fanOutAll(t, w.s.tenantId)).toEqual(['target_closed', 'fanned_out']);
    expect((await eventRows(w.s.tenantId, 'checklist.due_soon')).map((e) => [e.outcome, e.processed_at !== null])).toEqual([['target_closed', true]]);
    for (const worker of w.workers) expect((await inboxOf(worker.id)).filter((n) => n.type === 'checklist.due_soon')).toEqual([]);
  });

  it('tells the managers, admins and the owner that a run finished, in the inbox only; never the executor', async () => {
    const { w, manager, admin, executionId } = await completedRun();
    await addDevice(w.s.tenantId, manager.id);
    expect(await eventRows(w.s.tenantId, 'checklist.completed')).toEqual([
      expect.objectContaining({ actor_user_id: w.workers[0].id, dedupe_key: `checklist.completed:${w.occurrenceId}`, payload: { occurrenceId: w.occurrenceId, executionId } }),
    ]);
    expect(await fanOutAll(t, w.s.tenantId)).toEqual(['fanned_out']);
    for (const userId of [manager.id, admin.id, w.s.ownerId]) {
      expect((await inboxOf(userId)).filter((n) => n.type === 'checklist.completed'), userId).toEqual([
        expect.objectContaining({ title: 'Yoxlama bitdi', body: 'İcra yoxlaması — Filial 1: İşçi 1', target_kind: 'occurrence', target_id: w.occurrenceId, target_date: '2026-11-02', read_at: null }),
      ]);
    }
    expect(await deliveriesOf(manager.id)).toEqual([]);
    for (const worker of w.workers) expect((await inboxOf(worker.id)).filter((n) => n.type === 'checklist.completed')).toEqual([]);
  });

  it('records checklist.completed once for a run that goes on to the audit queue, and not again for a resubmit', async () => {
    const a = await auditWorld(t, clock, { requiresAudit: true });
    clock.set(T('05:00'));
    await sendBack(a.manager.api, a.executionId, { items: [{ itemId: a.w.c.temp.id, comment: 'Yenidən ölçün' }] });
    await fanOutAll(t, a.w.s.tenantId);
    expect((await inboxOf(a.worker.id)).filter((n) => n.type === 'run.correction_required').map((n) => n.read_at)).toEqual([null]);
    clock.set(T('06:00'));
    await a.worker.api.put(`/api/v1/executions/${a.executionId}/answers`, answersBody(2, { ...a.answers, [a.w.c.temp.id]: { number: 5 } }, T('06:00')));
    expect((await resubmit(a.worker.api, a.executionId, T('06:00'))).status).toBe(200);
    // The resubmit deals with the send-back: the executor's correction request is read.
    expect((await inboxOf(a.worker.id)).filter((n) => n.type === 'run.correction_required').map((n) => n.read_at)).toEqual([new Date(T('06:00'))]);
    expect(await eventRows(a.w.s.tenantId, 'checklist.completed')).toHaveLength(1);
  });

  it('clears the executor’s task to-dos once the task is handed in or cancelled, and the reviewer’s once it is reviewed', async () => {
    const w = await taskWorld(t);
    const worker = w.workers[0];
    const task = await createTask(w.manager.api, newTaskBody({ userId: worker.id }, { requiresReview: true }));
    await fanOutAll(t, w.s.tenantId);
    expect(await inboxState(worker.id)).toEqual([['task.assigned', false]]);
    clock.set(T('04:20'));
    await act(worker.api, task.id, 'start', T('04:10'));
    expect((await worker.api.post(`/api/v1/tasks/${task.id}/submissions`, { id: uuidv7(), submittedAt: T('04:15') })).body.status).toBe('awaiting_review');
    expect(await inboxState(worker.id)).toEqual([['task.assigned', true]]);
    await fanOutAll(t, w.s.tenantId);
    expect(await inboxState(w.manager.id)).toEqual([['task.submitted', false]]);
    expect((await w.manager.api.post(`/api/v1/tasks/${task.id}/review`, { decision: 'reject', comment: 'Foto yoxdur' })).status).toBe(200);
    expect(await inboxState(w.manager.id)).toEqual([['task.submitted', true]]);
    await fanOutAll(t, w.s.tenantId);
    expect(await inboxState(worker.id)).toEqual([['task.assigned', true], ['task.rejected', false]]);
    clock.set(T('04:30'));
    expect((await worker.api.post(`/api/v1/tasks/${task.id}/submissions`, { id: uuidv7(), submittedAt: T('04:25') })).body.status).toBe('awaiting_review');
    expect(await inboxState(worker.id)).toEqual([['task.assigned', true], ['task.rejected', true]]);

    const other = await createTask(w.manager.api, newTaskBody({ userId: worker.id }));
    await fanOutAll(t, w.s.tenantId);
    expect((await w.manager.api.post(`/api/v1/tasks/${other.id}/cancel`, { reason: 'Lazım deyil' })).status).toBe(200);
    expect((await inboxOf(worker.id)).filter((n) => n.target_id === other.id).map((n) => [n.type, n.read_at !== null])).toEqual([['task.assigned', true]]);
  });

  it('markReadForTarget touches only unread rows of the given types about that target', async () => {
    const w = await taskWorld(t);
    const worker = w.workers[0];
    const task = await createTask(w.manager.api, newTaskBody({ userId: worker.id }));
    const other = await createTask(w.manager.api, newTaskBody({ userId: worker.id }));
    await fanOutAll(t, w.s.tenantId);
    clock.set(T('04:30'));
    const mark = (id: string, types: Parameters<InboxService['markReadForTarget']>[1], kind: 'task' | 'occurrence' = 'task') =>
      t.app.get(DbService).withTenant(w.s.tenantId, null, () => t.app.get(InboxService).markReadForTarget({ kind, id }, types));
    expect(await mark(task.id, ['task.overdue'])).toBe(0);
    expect(await mark(task.id, ['task.assigned'], 'occurrence')).toBe(0);
    expect(await mark(task.id, [])).toBe(0);
    expect(await mark(task.id, ['task.assigned', 'task.overdue'])).toBe(1);
    clock.set(T('05:00'));
    expect(await mark(task.id, ['task.assigned'])).toBe(0);
    const rows = await inboxOf(worker.id);
    expect(rows.map((n) => [n.target_id, n.read_at])).toEqual([
      [task.id, new Date(T('04:30'))],
      [other.id, null],
    ]);
  });
});
