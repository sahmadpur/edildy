import { randomUUID } from 'node:crypto';
import type { DataScope, PermissionKey } from '@taskop/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TaskReader } from '../src/common/request';
import { DbService } from '../src/db/db.service';
import { problemReports, sites } from '../src/db/schema';
import { ProblemReportScope } from '../src/problem-reports/problem-report-scope';
import { createTestApp, type TestApp } from './app';
import { FakeClock } from './fake-clock';
import { createUserDirect } from './fixtures';
import { staffAt } from './notification-fixtures';
import { ownerQuery } from './owner-db';
import { createAssignment, MONDAY_0800, schedulingWorld } from './scheduling-fixtures';

const reader = (userId: string, dataScope: DataScope, permissions: PermissionKey[] = []): TaskReader => ({ userId, dataScope, permissions: new Set(permissions) });

/** 2026-11-06 design §6.1: who reads which reports, and where a user may report. */
describe('problem report scope', () => {
  const clock = new FakeClock(MONDAY_0800);
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({}, { clock });
  });
  afterAll(() => t.close());

  async function world() {
    const w = await schedulingWorld(t);
    // Worker 2 moves to site 2; worker 1 stays at site 1 and reports to the boss.
    expect((await w.api.put(`/api/v1/users/${w.workers[1]}/sites`, { siteIds: [w.otherSiteId] })).status).toBe(200);
    const boss = await createUserDirect(t, w.s.tenantId, { kind: 'staff', roleKey: 'manager', fullName: 'Rəhbər' });
    await ownerQuery('update users set manager_id = $1 where id = $2', [boss.id, w.workers[0]]);
    const m1 = await staffAt(t, w.s.tenantId, w.api, 'manager', [w.siteId], 'Menecer 1');
    const m2 = await staffAt(t, w.s.tenantId, w.api, 'manager', [w.otherSiteId], 'Menecer 2');
    const insert = (id: string, siteId: string, reporter: string) =>
      ownerQuery(`insert into problem_reports (id, tenant_id, site_id, reporter_user_id, severity, text, reported_at) values ($1, $2, $3, $4, 'normal', 'x', now())`, [id, w.s.tenantId, siteId, reporter]);
    const [r1, r2] = [randomUUID(), randomUUID()].sort() as [string, string];
    await insert(r1, w.siteId, w.workers[0]!);
    await insert(r2, w.otherSiteId, w.workers[1]!);
    const scope = t.app.get(ProblemReportScope);
    const db = t.app.get(DbService);
    const readable = (p: TaskReader) =>
      db.withTenant(w.s.tenantId, null, async (tx) => (await tx.select({ id: problemReports.id }).from(problemReports).where(scope.readable(p)).orderBy(problemReports.id)).map((r) => r.id));
    const reportable = (p: TaskReader) =>
      db.withTenant(w.s.tenantId, null, async (tx) => (await tx.select({ id: sites.id }).from(sites).where(scope.reportableSites(p))).map((r) => r.id).sort());
    return { w, boss, m1, m2, r1, r2, scope, db, readable, reportable };
  }

  it('readable: own scope sees only own reports; managers their subtree; a boss their subordinates; admins everything', async () => {
    const { w, boss, m1, m2, r1, r2, readable } = await world();
    expect(await readable(reader(w.workers[0]!, 'own'))).toEqual([r1]);
    expect(await readable(reader(w.workers[1]!, 'own'))).toEqual([r2]);
    expect(await readable(reader(m1.id, 'site_subtree', ['assignments.view']))).toEqual([r1]);
    expect(await readable(reader(m2.id, 'site_subtree', ['assignments.view']))).toEqual([r2]);
    expect(await readable(reader(boss.id, 'subordinates', ['assignments.view']))).toEqual([r1]);
    expect(await readable(reader(w.s.ownerId, 'all', ['assignments.view']))).toEqual([r1, r2]);
    // Without assignments.view a wide scope still sees only its own reports.
    expect(await readable(reader(m1.id, 'site_subtree'))).toEqual([]);
    expect(await readable(reader(w.s.ownerId, 'all'))).toEqual([]);
  });

  it('reportableSites: a worker sees their user_sites and the sites of their checklists; a manager their subtree', async () => {
    const { w, m1, reportable } = await world();
    expect(await reportable(reader(w.workers[0]!, 'own'))).toEqual([w.siteId]);
    expect(await reportable(reader(w.workers[1]!, 'own'))).toEqual([w.otherSiteId]);
    expect(await reportable(reader(m1.id, 'site_subtree', ['assignments.view']))).toEqual([w.siteId]);
    expect(await reportable(reader(w.s.ownerId, 'all'))).toEqual([w.siteId, w.otherSiteId].sort());
    // Worker 1 is assigned a checklist at site 1 and then detached from the site: the checklist still makes it reportable.
    await createAssignment(w, { assigneeIds: [w.workers[0]] });
    await ownerQuery('delete from user_sites where user_id = $1', [w.workers[0]]);
    expect(await reportable(reader(w.workers[0]!, 'own'))).toEqual([w.siteId]);
  });

  it('assertReportable refuses a site outside the set (SITE_NOT_ALLOWED), an inactive one (SITE_INACTIVE) and an unknown one', async () => {
    const { w, scope, db } = await world();
    const check = (p: TaskReader, siteId: string) => db.withTenant(w.s.tenantId, null, () => scope.assertReportable(p, siteId));
    await expect(check(reader(w.workers[0]!, 'own'), w.siteId)).resolves.toBeUndefined();
    await expect(check(reader(w.workers[0]!, 'own'), w.otherSiteId)).rejects.toThrow('SITE_NOT_ALLOWED');
    await ownerQuery('update sites set active = false where id = $1', [w.otherSiteId]);
    await expect(check(reader(w.workers[1]!, 'own'), w.otherSiteId)).rejects.toThrow('SITE_INACTIVE');
    await expect(check(reader(w.s.ownerId, 'all'), '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4eff')).rejects.toThrow('REFERENCE_NOT_FOUND');
  });
});
