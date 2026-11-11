import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './app';
import { as, createUserDirect, loginStaff, loginWorker, signupTenant } from './fixtures';

describe('GET /audit-log', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('lists entries newest first with actor names and filters', async () => {
    const s = await signupTenant(t);
    const owner = as(t, s.accessToken);
    await owner.post('/api/v1/teams', { name: 'Audit me' });
    const all = (await owner.get('/api/v1/audit-log')).body;
    expect(all.items[0]).toMatchObject({ action: 'team.created', actor: { type: 'user', id: s.ownerId, name: 'Elvin Əhmədov' } });
    expect(all.items[0].after).toMatchObject({ name: 'Audit me' });

    const filtered = (await owner.get('/api/v1/audit-log?action=team.created')).body;
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].actor.type).toBe('user');

    const page = (await owner.get('/api/v1/audit-log?limit=1')).body;
    const next = (await owner.get(`/api/v1/audit-log?limit=1&cursor=${page.nextCursor}`)).body;
    expect(next.items[0].id < page.items[0].id).toBe(true);

    const future = (await owner.get(`/api/v1/audit-log?from=${encodeURIComponent(new Date(Date.now() + 60_000).toISOString())}`)).body;
    expect(future.items).toHaveLength(0);
  });

  it('allows auditors and blocks workers', async () => {
    const s = await signupTenant(t);
    const a = await createUserDirect(t, s.tenantId, { kind: 'staff', roleKey: 'auditor' });
    expect((await as(t, (await loginStaff(t, a.email!, a.secret)).accessToken).get('/api/v1/audit-log')).status).toBe(200);
    const w = await createUserDirect(t, s.tenantId);
    expect((await as(t, (await loginWorker(t, s.orgCode, w.username!, w.secret)).accessToken).get('/api/v1/audit-log')).status).toBe(403);
  });

  it('stores the caller’s client on every entry and filters by it', async () => {
    const s = await signupTenant(t, { client: 'web' });
    const owner = as(t, s.accessToken);
    await owner.post('/api/v1/teams', { name: 'From the web' });
    const mobile = as(t, (await loginStaff(t, s.email, 'owner password 1', 'mobile')).accessToken);
    await mobile.post('/api/v1/teams', { name: 'From the phone' });

    const all = (await owner.get('/api/v1/audit-log')).body;
    const byName = (name: string) => all.items.find((e: { after: { name?: string } | null }) => e.after?.name === name);
    expect(byName('From the web').client).toBe('web');
    expect(byName('From the phone').client).toBe('mobile');
    // The logins are tagged too: the first from the web, the second from the phone (newest first).
    const logins = all.items.filter((e: { action: string }) => e.action === 'auth.login_succeeded').map((e: { client: string }) => e.client);
    expect(logins).toEqual(['mobile', 'web']);

    const web = (await owner.get('/api/v1/audit-log?client=web')).body;
    expect(web.items.every((e: { client: string }) => e.client === 'web')).toBe(true);
    expect(web.items.map((e: { after: { name?: string } | null }) => e.after?.name)).toContain('From the web');
    const phone = (await owner.get('/api/v1/audit-log?client=mobile')).body;
    expect(phone.items.filter((e: { action: string }) => e.action === 'team.created').map((e: { after: { name?: string } | null }) => e.after?.name)).toEqual(['From the phone']);
    expect((await owner.get('/api/v1/audit-log?client=desktop')).status).toBe(400);
  });
});
