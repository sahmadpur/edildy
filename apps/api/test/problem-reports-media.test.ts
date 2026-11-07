import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './app';
import { FakeClock } from './fake-clock';
import { MemoryStorage } from './memory-storage';
import { ownerQuery } from './owner-db';
import { createReport, newReportBody, reportWorld } from './problem-report-fixtures';
import { MONDAY_0800 } from './scheduling-fixtures';
import { createTask, newTaskBody, taskMediaBody } from './task-fixtures';

/** 2026-11-06 design §6.2: a report's photos and videos, registered by the reporter, readable within scope. */
describe('problem report media', () => {
  const clock = new FakeClock(MONDAY_0800);
  const storage = new MemoryStorage();
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({}, { clock, storage });
  });
  beforeEach(() => clock.set(MONDAY_0800));
  afterAll(() => t.close());

  const body = (extra: Record<string, unknown> = {}) => {
    const { role: _role, ...rest } = taskMediaBody('instruction', extra);
    return rest;
  };

  it('registers, confirms and signs a medium for the reporter; a manager in scope reads it, one out of scope does not', async () => {
    const w = await reportWorld(t);
    const r = await createReport(w.workers[0].api, newReportBody(w.siteId));
    const m = body();
    const res = await w.workers[0].api.post(`/api/v1/problem-reports/${r.id}/media`, m);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ mediaId: m.id, status: 'pending', headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1000' } });
    expect(res.body.uploadUrl).toContain(`/t/${w.s.tenantId}/pr/${r.id}/${m.id}.jpg`);
    // The same id again: a fresh URL while pending.
    expect((await w.workers[0].api.post(`/api/v1/problem-reports/${r.id}/media`, m)).body).toMatchObject({ mediaId: m.id, status: 'pending' });
    // Before the upload the report lists it as pending and no URL can be signed.
    expect((await w.workers[0].api.get(`/api/v1/problem-reports/${r.id}`)).body.media).toEqual([{ id: m.id, kind: 'photo', status: 'pending' }]);
    expect((await w.managerHere.api.get(`/api/v1/problem-report-media/${m.id}/url`)).body.error.code).toBe('MEDIA_NOT_FOUND_IN_STORAGE');
    await storage.putObject(`t/${w.s.tenantId}/pr/${r.id}/${m.id}.jpg`, Buffer.alloc(1000), 'image/jpeg');
    const confirmed = await w.workers[0].api.post(`/api/v1/problem-report-media/${m.id}/uploaded`);
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    expect(confirmed.body.status).toBe('uploaded');
    expect((await w.workers[0].api.post(`/api/v1/problem-reports/${r.id}/media`, m)).body).toMatchObject({ status: 'uploaded', uploadUrl: null });
    expect((await w.managerHere.api.get(`/api/v1/problem-report-media/${m.id}/url`)).status).toBe(200);
    expect((await w.workers[0].api.get(`/api/v1/problem-report-media/${m.id}/url`)).status).toBe(200);
    expect((await w.managerThere.api.get(`/api/v1/problem-report-media/${m.id}/url`)).status).toBe(404);
    // Task readers reach it through the task.
    const task = await createTask(w.managerHere.api, newTaskBody({ userId: w.workers[0].id }, { problemReportId: r.id }));
    expect((await w.workers[0].api.get(`/api/v1/tasks/${task.id}/report-media/${m.id}/url`)).status).toBe(200);
    expect((await w.managerThere.api.get(`/api/v1/tasks/${task.id}/report-media/${m.id}/url`)).status).toBe(404);
  });

  it('refuses a sixth medium, media on a closed report, another user, bad types and future times', async () => {
    const w = await reportWorld(t);
    const r = await createReport(w.workers[0].api, newReportBody(w.siteId));
    const code = async (api: typeof w.owner, extra: Record<string, unknown> = {}) => {
      const res = await api.post(`/api/v1/problem-reports/${r.id}/media`, body(extra));
      return [res.status, res.body.error?.code];
    };
    expect(await code(w.workers[1].api)).toEqual([404, 'NOT_FOUND']);
    expect(await code(w.managerHere.api)).toEqual([404, 'NOT_FOUND']);
    expect(await code(w.workers[0].api, { mime: 'image/gif' })).toEqual([422, 'MEDIA_TYPE_INVALID']);
    expect(await code(w.workers[0].api, { bytes: 5_242_881 })).toEqual([422, 'MEDIA_TOO_LARGE']);
    expect(await code(w.workers[0].api, { capturedAt: '2026-11-02T04:02:00.001Z' })).toEqual([422, 'CLOCK_INVALID']);
    for (let i = 0; i < 5; i++) expect(await code(w.workers[0].api)).toEqual([200, undefined]);
    expect(await code(w.workers[0].api)).toEqual([422, 'MEDIA_LIMIT_REACHED']);
    expect((await ownerQuery('select count(*)::int as n from problem_report_media where report_id = $1', [r.id])).rows[0]!.n).toBe(5);
    const r2 = await createReport(w.workers[0].api, newReportBody(w.siteId));
    expect((await w.managerHere.api.post(`/api/v1/problem-reports/${r2.id}/close`, { comment: 'Bağlandı' })).status).toBe(200);
    const closed = await w.workers[0].api.post(`/api/v1/problem-reports/${r2.id}/media`, body());
    expect([closed.status, closed.body.error.code]).toEqual([409, 'PROBLEM_REPORT_CLOSED']);
  });
});
