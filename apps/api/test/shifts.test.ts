import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './app';
import { as, createUserDirect, loginWorker, uniq } from './fixtures';
import { ownerQuery } from './owner-db';
import { schedulingWorld } from './scheduling-fixtures';

describe('shifts', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('creates, lists, edits and deactivates shift templates with an audit trail', async () => {
    const w = await schedulingWorld(t, 0);
    const created = await w.api.post('/api/v1/shifts', { name: 'Səhər', ranges: [{ startTime: '08:00', endTime: '16:00' }] });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ name: 'Səhər', ranges: [{ startTime: '08:00', endTime: '16:00' }], siteId: null, siteName: null, active: true });
    const night = (await w.api.post('/api/v1/shifts', { name: 'Gecə', ranges: [{ startTime: '22:00', endTime: '06:00' }], siteId: w.otherSiteId })).body;
    expect(night).toMatchObject({ siteId: w.otherSiteId, siteName: 'Filial 2' });

    // siteId filter includes tenant-wide shifts.
    expect((await w.api.get(`/api/v1/shifts?siteId=${w.siteId}`)).body.map((s: { name: string }) => s.name)).toEqual(['Səhər']);
    expect((await w.api.get(`/api/v1/shifts?siteId=${w.otherSiteId}`)).body.map((s: { name: string }) => s.name)).toEqual(['Səhər', 'Gecə']);

    const edited = await w.api.patch(`/api/v1/shifts/${created.body.id}`, { ranges: [{ startTime: '08:00', endTime: '15:00' }], active: false });
    expect(edited.body).toMatchObject({ ranges: [{ startTime: '08:00', endTime: '15:00' }], active: false });
    expect((await w.api.get('/api/v1/shifts?active=true')).body.map((s: { name: string }) => s.name)).toEqual(['Gecə']);

    const audit = await ownerQuery<{ action: string }>('select action from audit_log where entity_id = $1 order by occurred_at, id', [created.body.id]);
    expect(audit.rows.map((r) => r.action)).toEqual(['shift.created', 'shift.updated']);
  });

  it('rejects zero-length shifts and unknown sites', async () => {
    const w = await schedulingWorld(t, 0);
    const zero = await w.api.post('/api/v1/shifts', { name: 'X', ranges: [{ startTime: '08:00', endTime: '08:00' }] });
    expect(zero.status).toBe(400);
    expect(zero.body.error.fields).toEqual({ 'ranges.0.endTime': 'scheduling.issues.shiftZeroLength' });
    const id = (await w.api.post('/api/v1/shifts', { name: 'Səhər', ranges: [{ startTime: '08:00', endTime: '16:00' }] })).body.id;
    const overlap = await w.api.patch(`/api/v1/shifts/${id}`, { ranges: [{ startTime: '08:00', endTime: '10:00' }, { startTime: '09:00', endTime: '11:00' }] });
    expect(overlap.body.error).toMatchObject({ code: 'VALIDATION_FAILED', fields: { 'ranges.1.startTime': 'scheduling.issues.shiftRangesOverlap' } });
    const other = await schedulingWorld(t, 0);
    expect((await w.api.post('/api/v1/shifts', { name: 'X', ranges: [{ startTime: '08:00', endTime: '16:00' }], siteId: other.siteId })).status).toBe(422);
  });

  it('requires shifts permissions', async () => {
    const w = await schedulingWorld(t, 0);
    const worker = await createUserDirect(t, w.s.tenantId);
    const api = as(t, (await loginWorker(t, w.s.orgCode, worker.username!, worker.secret)).accessToken);
    expect((await api.get('/api/v1/shifts')).status).toBe(403);
    expect((await api.post('/api/v1/shifts', { name: 'X', ranges: [{ startTime: '08:00', endTime: '16:00' }] })).status).toBe(403);
  });

  it('lets a platform admin manage shifts inside a tenant', async () => {
    const w = await schedulingWorld(t, 0);
    const email = `${uniq('admin')}@edildy.az`;
    const admin = await ownerQuery<{ id: string }>(
      "insert into platform_admins (id, email, credential_hash, full_name) values (gen_random_uuid(), $1, $2, 'Support') returning id",
      [email, await hash('platform password 1', { memoryCost: 1024, timeCost: 1, parallelism: 1 })],
    );
    const token = (await t.http().post('/api/v1/platform/auth/login').send({ email, password: 'platform password 1' })).body.accessToken;
    const p = as(t, token);
    const res = await p.post(`/api/v1/platform/tenants/${w.s.tenantId}/shifts`, { name: 'Səhər', ranges: [{ startTime: '08:00', endTime: '16:00' }] });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect((await w.api.get('/api/v1/shifts')).body.map((s: { id: string }) => s.id)).toEqual([res.body.id]);
    const audit = await ownerQuery<{ actor_platform_admin_id: string }>('select actor_platform_admin_id from audit_log where entity_id = $1', [res.body.id]);
    expect(audit.rows[0]!.actor_platform_admin_id).toBe(admin.rows[0]!.id);
  });
});
