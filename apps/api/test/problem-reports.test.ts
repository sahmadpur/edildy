import type { ProblemReportDto } from '@edildy/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './app';
import { FakeClock } from './fake-clock';
import { ownerQuery } from './owner-db';
import { captureReportEvents, createReport, newReportBody, reportAuditActions, reportWorld } from './problem-report-fixtures';
import { MONDAY_0800 } from './scheduling-fixtures';
import { createTask, newTaskBody } from './task-fixtures';

/** 2026-11-06 design §6.2: create, list, read and close problem reports. */
describe('problem reports', () => {
  const clock = new FakeClock(MONDAY_0800);
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({}, { clock });
  });
  afterAll(() => t.close());

  it('a worker creates a report at their site; repeating the id returns the same row; another user gets 409', async () => {
    const w = await reportWorld(t);
    const body = newReportBody(w.siteId);
    const first = await createReport(w.workers[0].api, body);
    expect(first).toMatchObject({ id: body.id, siteId: w.siteId, siteName: 'Filial 1', severity: 'normal', text: body.text, state: 'open', taskId: null, closedAt: null, media: [] });
    expect(first.reporter.id).toBe(w.workers[0].id);
    expect(first.location).toEqual({ lat: 40.4093, lng: 49.8671, accuracyM: 12, capturedAt: '2026-11-02T04:00:00.000Z' });
    const again = await createReport(w.workers[0].api, { ...body, text: 'changed' });
    expect(again).toEqual(first);
    expect((await ownerQuery('select count(*)::int as n from problem_reports where id = $1', [body.id])).rows[0]!.n).toBe(1);
    const other = await w.workers[1].api.post('/api/v1/problem-reports', { ...body, siteId: w.otherSiteId });
    expect(other.status).toBe(409);
  });

  it('refuses a site the worker is not attached to with SITE_NOT_ALLOWED, a future device time, and text over the limit', async () => {
    const w = await reportWorld(t);
    const res = await w.workers[0].api.post('/api/v1/problem-reports', newReportBody(w.otherSiteId));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SITE_NOT_ALLOWED');
    const future = await w.workers[0].api.post('/api/v1/problem-reports', newReportBody(w.siteId, { reportedAt: '2026-11-02T05:00:00.000Z' }));
    expect(future.body.error.code).toBe('CLOCK_INVALID');
    const long = await w.workers[0].api.post('/api/v1/problem-reports', newReportBody(w.siteId, { text: 'x'.repeat(2001) }));
    expect(long.status).toBe(400);
  });

  it('stores location null when the phone had none', async () => {
    const w = await reportWorld(t);
    const r = await createReport(w.workers[0].api, newReportBody(w.siteId, { location: null }));
    expect(r.location).toBeNull();
    const row = await ownerQuery<{ lat: number | null; location_at: Date | null }>('select lat, location_at from problem_reports where id = $1', [r.id]);
    expect(row.rows[0]).toEqual({ lat: null, location_at: null });
  });

  it('lists: the reporter sees only theirs; a manager their subtree; the admin everything; the state filter defaults to active', async () => {
    const w = await reportWorld(t);
    const mine = await createReport(w.workers[0].api, newReportBody(w.siteId));
    const theirs = await createReport(w.workers[1].api, newReportBody(w.otherSiteId, { severity: 'critical' }));
    const ids = async (api: typeof w.owner, q = '') => {
      const res = await api.get(`/api/v1/problem-reports${q}`);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      return (res.body.items as ProblemReportDto[]).map((r) => r.id);
    };
    expect(await ids(w.workers[0].api)).toEqual([mine.id]);
    expect(await ids(w.workers[1].api)).toEqual([theirs.id]);
    expect(await ids(w.managerHere.api)).toEqual([mine.id]);
    expect(await ids(w.managerThere.api)).toEqual([theirs.id]);
    expect(await ids(w.admin.api)).toEqual([theirs.id, mine.id]); // newest first
    expect(await ids(w.admin.api, `?siteId=${w.siteId}`)).toEqual([mine.id]);
    expect(await ids(w.admin.api, '?state=closed')).toEqual([]);
    // GET /:id follows the same rule.
    expect((await w.managerThere.api.get(`/api/v1/problem-reports/${mine.id}`)).status).toBe(404);
    expect((await w.managerHere.api.get(`/api/v1/problem-reports/${mine.id}`)).status).toBe(200);
  });

  it('close: a manager in scope closes with a comment; again → PROBLEM_REPORT_CLOSED; out of scope → 404; a worker → 403', async () => {
    const w = await reportWorld(t);
    const r = await createReport(w.workers[0].api, newReportBody(w.siteId));
    expect((await w.workers[0].api.post(`/api/v1/problem-reports/${r.id}/close`, { comment: 'Özüm düzəltdim' })).status).toBe(403);
    expect((await w.managerThere.api.post(`/api/v1/problem-reports/${r.id}/close`, { comment: 'Yox' })).status).toBe(404);
    const closed = await w.managerHere.api.post(`/api/v1/problem-reports/${r.id}/close`, { comment: 'Yerində düzəldildi' });
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    expect(closed.body).toMatchObject({ state: 'closed', closeComment: 'Yerində düzəldildi', closedBy: { id: w.managerHere.id } });
    expect(closed.body.closedAt).toBe(MONDAY_0800.replace('Z', '.000Z'));
    const again = await w.managerHere.api.post(`/api/v1/problem-reports/${r.id}/close`, { comment: 'Yenə' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('PROBLEM_REPORT_CLOSED');
    // The reporter sees the closed state and the filter.
    const list = await w.workers[0].api.get('/api/v1/problem-reports?state=closed');
    expect((list.body.items as ProblemReportDto[]).map((x) => x.id)).toEqual([r.id]);
    expect((await w.workers[0].api.get('/api/v1/problem-reports')).body.items).toEqual([]);
  });

  it('close refuses while a non-cancelled task exists (PROBLEM_REPORT_HAS_TASK)', async () => {
    const w = await reportWorld(t);
    const r = await createReport(w.workers[0].api, newReportBody(w.siteId));
    await createTask(w.managerHere.api, newTaskBody({ userId: w.workers[0].id }, { problemReportId: r.id, title: undefined }));
    const res = await w.managerHere.api.post(`/api/v1/problem-reports/${r.id}/close`, { comment: 'Bağla' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PROBLEM_REPORT_HAS_TASK');
  });

  it('writes audit rows and emits the events', async () => {
    const w = await reportWorld(t);
    const cap = captureReportEvents(t);
    try {
      const r = await createReport(w.workers[0].api, newReportBody(w.siteId, { severity: 'critical' }));
      expect((await w.managerHere.api.post(`/api/v1/problem-reports/${r.id}/close`, { comment: 'Həll olundu' })).status).toBe(200);
      expect(await reportAuditActions(r.id)).toEqual(['problem_report.created', 'problem_report.closed']);
      expect(cap.seen).toEqual([
        ['problem_report.created', r.id, w.workers[0].id],
        ['problem_report.closed', r.id, w.managerHere.id],
      ]);
    } finally {
      cap.stop();
    }
  });

  it('GET /problem-reports/sites returns the reporter’s sites, and nothing for a worker with none', async () => {
    const w = await reportWorld(t);
    const res = await w.workers[0].api.get('/api/v1/problem-reports/sites');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: w.siteId, name: 'Filial 1' }]);
    await ownerQuery('delete from user_sites where user_id = $1', [w.workers[0].id]);
    expect((await w.workers[0].api.get('/api/v1/problem-reports/sites')).body).toEqual([]);
    const all = await w.admin.api.get('/api/v1/problem-reports/sites');
    expect((all.body as { name: string }[]).map((s) => s.name).sort()).toEqual(['Filial 1', 'Filial 2']);
  });
});
