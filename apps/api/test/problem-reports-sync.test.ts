import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './app';
import { FakeClock } from './fake-clock';
import { ownerQuery } from './owner-db';
import { createReport, newReportBody, reportWorld } from './problem-report-fixtures';
import { type Api, MONDAY_0800 } from './scheduling-fixtures';

const pull = (api: Api, known: string[] = []) => api.get(`/api/v1/me/sync${known.length ? `?knownProblemReportIds=${known.join(',')}` : ''}`);
const ids = (body: { problemReports: Array<{ id: string }> }) => body.problemReports.map((x) => x.id);

/** 2026-11-06 design §6.3: the caller's own reports and the sites they may report at. */
describe('problem reports in the download sync', () => {
  const clock = new FakeClock(MONDAY_0800);
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({}, { clock });
  });
  beforeEach(() => clock.set(MONDAY_0800));
  afterAll(() => t.close());

  it('lists the caller’s own reports of the last 30 days plus older open ones, their sites, and removed ids; never others’ reports', async () => {
    const w = await reportWorld(t);
    const mine = await createReport(w.workers[0].api, newReportBody(w.siteId));
    const theirs = await createReport(w.workers[1].api, newReportBody(w.otherSiteId));
    const res = await pull(w.workers[0].api);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(ids(res.body)).toEqual([mine.id]);
    expect(res.body.problemReports[0]).toMatchObject({ id: mine.id, state: 'open', siteName: 'Filial 1' });
    expect(res.body.reportSites).toEqual([{ id: w.siteId, name: 'Filial 1' }]);
    expect(res.body.removedProblemReportIds).toEqual([]);
    expect(ids((await pull(w.workers[1].api)).body)).toEqual([theirs.id]);
    // A manager's sync carries only their own reports (none), never their scope.
    expect(ids((await pull(w.managerHere.api)).body)).toEqual([]);
    // An old closed report leaves the set and is reported as removed when known; an old open one stays.
    const oldOpen = await createReport(w.workers[0].api, newReportBody(w.siteId));
    const oldClosed = await createReport(w.workers[0].api, newReportBody(w.siteId));
    expect((await w.managerHere.api.post(`/api/v1/problem-reports/${oldClosed.id}/close`, { comment: 'Bağlandı' })).status).toBe(200);
    await ownerQuery("update problem_reports set created_at = created_at - interval '31 days' where id = any($1)", [[oldOpen.id, oldClosed.id]]);
    const later = await pull(w.workers[0].api, [mine.id, oldOpen.id, oldClosed.id]);
    expect(ids(later.body).sort()).toEqual([mine.id, oldOpen.id].sort());
    expect(later.body.removedProblemReportIds).toEqual([oldClosed.id]);
  });
});
