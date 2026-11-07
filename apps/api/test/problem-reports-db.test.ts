import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './app';
import { signupTenant } from './fixtures';
import { ownerQuery } from './owner-db';

const TABLES = ['problem_reports', 'problem_report_media'];

/** 2026-11-06 design §5: the problem report tables, RLS and the task link. */
describe('problem report tables', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('forces row level security on both tables and has the task link constraints', async () => {
    const rls = await ownerQuery<{ relname: string; relforcerowsecurity: boolean }>('select relname, relforcerowsecurity from pg_class where relname = any($1) order by relname', [TABLES]);
    expect(rls.rows).toEqual([
      { relname: 'problem_report_media', relforcerowsecurity: true },
      { relname: 'problem_reports', relforcerowsecurity: true },
    ]);
    const cons = await ownerQuery<{ conname: string }>(
      `select conname from pg_constraint where conname in ('tasks_one_source_ck','problem_reports_location_ck','problem_reports_closed_ck','tasks_problem_report_fk') order by conname`,
    );
    expect(cons.rows.map((r) => r.conname)).toEqual(['problem_reports_closed_ck', 'problem_reports_location_ck', 'tasks_one_source_ck', 'tasks_problem_report_fk']);
    const idx = await ownerQuery<{ indexname: string }>(`select indexname from pg_indexes where indexname = 'tasks_problem_report_active_uq'`);
    expect(idx.rows).toHaveLength(1);
    const kinds = await ownerQuery<{ enumlabel: string }>(`select enumlabel from pg_enum e join pg_type ty on ty.oid = e.enumtypid where ty.typname = 'notification_target_kind'`);
    expect(kinds.rows.map((r) => r.enumlabel)).toContain('problem_report');
  });

  it('refuses a half location and a half close', async () => {
    const s = await signupTenant(t);
    const site = await ownerQuery<{ id: string }>(
      `insert into sites (id, tenant_id, type_id, name, path) select gen_random_uuid(), $1, id, 'Filial', 'r' from site_types where tenant_id = $1 limit 1 returning id`,
      [s.tenantId],
    );
    const base = `insert into problem_reports (id, tenant_id, site_id, reporter_user_id, severity, text, reported_at`;
    const vals = `values (gen_random_uuid(), $1, $2, $3, 'normal', 'x', now()`;
    await expect(ownerQuery(`${base}, lat) ${vals}, 40.4)`, [s.tenantId, site.rows[0]!.id, s.ownerId])).rejects.toThrow(/problem_reports_location_ck/);
    await expect(ownerQuery(`${base}, closed_at) ${vals}, now())`, [s.tenantId, site.rows[0]!.id, s.ownerId])).rejects.toThrow(/problem_reports_closed_ck/);
    await expect(ownerQuery(`${base}, lat, lng, location_at) ${vals}, 40.4, 49.8, now())`, [s.tenantId, site.rows[0]!.id, s.ownerId])).resolves.toBeTruthy();
  });
});
