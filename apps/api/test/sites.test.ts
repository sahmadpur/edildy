import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './app';
import { as, createUserDirect, loginStaff, loginWorker, signupTenant, siteTypeIdOf } from './fixtures';
import { ownerQuery } from './owner-db';

describe('tenant settings', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('reads and updates name and timezone, with audit', async () => {
    const s = await signupTenant(t);
    const owner = as(t, s.accessToken);
    expect((await owner.get('/api/v1/tenant')).body).toMatchObject({ orgCode: s.orgCode, timezone: 'Asia/Baku' });
    const bad = await owner.patch('/api/v1/tenant', { timezone: 'Mars/Base' });
    expect(bad.body.error.fields).toEqual({ timezone: 'errors.validation.timezone' });
    const ok = await owner.patch('/api/v1/tenant', { name: 'Acme Group', timezone: 'Europe/Istanbul' });
    expect(ok.body).toMatchObject({ name: 'Acme Group', timezone: 'Europe/Istanbul' });
    const audit = await ownerQuery("select before, after from audit_log where tenant_id = $1 and action = 'tenant.updated'", [s.tenantId]);
    expect(audit.rows[0]).toMatchObject({ before: { timezone: 'Asia/Baku' }, after: { timezone: 'Europe/Istanbul' } });
  });

  it('only tenant.manage may update', async () => {
    const s = await signupTenant(t);
    const w = await createUserDirect(t, s.tenantId);
    const login = await loginWorker(t, s.orgCode, w.username!, w.secret);
    expect((await as(t, login.accessToken).get('/api/v1/tenant')).status).toBe(200);
    expect((await as(t, login.accessToken).patch('/api/v1/tenant', { name: 'Hacked' })).body.error.code).toBe('FORBIDDEN');
  });
});

describe('site types and sites', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('manages site types', async () => {
    const s = await signupTenant(t);
    const owner = as(t, s.accessToken);
    const created = await owner.post('/api/v1/site-types', { name: 'Anbar', sortOrder: 10 });
    expect(created.status).toBe(201);
    const updated = await owner.patch(`/api/v1/site-types/${created.body.id}`, { active: false });
    expect(updated.body.active).toBe(false);
    const list = await owner.get('/api/v1/site-types');
    expect(list.body.map((x: { name: string }) => x.name)).toEqual(['Filial', 'Zona', 'Bölmə', 'Yoxlama nöqtəsi', 'Anbar']);
  });

  it('builds a tree and moves subtrees, updating descendant paths', async () => {
    const s = await signupTenant(t);
    const owner = as(t, s.accessToken);
    const typeId = await siteTypeIdOf(s.tenantId);
    const zoneTypeId = await siteTypeIdOf(s.tenantId, 'Zona');
    const sectionTypeId = await siteTypeIdOf(s.tenantId, 'Bölmə');
    const a = (await owner.post('/api/v1/sites', { parentId: null, typeId, name: 'Filial A' })).body;
    const a1 = (await owner.post('/api/v1/sites', { parentId: a.id, typeId: zoneTypeId, name: 'Zona A1', address: 'Bakı' })).body;
    const a11 = (await owner.post('/api/v1/sites', { parentId: a1.id, typeId: sectionTypeId, name: 'Bölmə A1.1' })).body;
    const b = (await owner.post('/api/v1/sites', { parentId: null, typeId, name: 'Filial B' })).body;
    expect(a11).toMatchObject({ parentId: a1.id, depth: 2 });

    const moved = await owner.post(`/api/v1/sites/${a1.id}/move`, { parentId: b.id });
    expect(moved.body).toMatchObject({ parentId: b.id, depth: 1 });
    const list = (await owner.get('/api/v1/sites')).body as Array<{ id: string; path: string; depth: number }>;
    const child = list.find((x) => x.id === a11.id)!;
    expect(child.path.startsWith(moved.body.path + '.')).toBe(true);
    expect(child.depth).toBe(2);

    // A zone cannot stand at the top: only the root type (Filial) can (feedback 2026-11-27).
    const toRoot = await owner.post(`/api/v1/sites/${a1.id}/move`, { parentId: null });
    expect(toRoot.body.error.code).toBe('SITE_LEVEL_INVALID');
  });

  it('refuses to move a site under itself or its descendant', async () => {
    const s = await signupTenant(t);
    const owner = as(t, s.accessToken);
    const typeId = await siteTypeIdOf(s.tenantId);
    const a = (await owner.post('/api/v1/sites', { parentId: null, typeId, name: 'A' })).body;
    const a1 = (await owner.post('/api/v1/sites', { parentId: a.id, typeId: await siteTypeIdOf(s.tenantId, 'Zona'), name: 'A1' })).body;
    expect((await owner.post(`/api/v1/sites/${a.id}/move`, { parentId: a1.id })).body.error.code).toBe('SITE_CYCLE');
    expect((await owner.post(`/api/v1/sites/${a.id}/move`, { parentId: a.id })).body.error.code).toBe('SITE_CYCLE');
  });

  it('levels: only Filial at the top, a child always of a lower level, on create, type change and move (feedback 2026-11-27)', async () => {
    const s = await signupTenant(t);
    const owner = as(t, s.accessToken);
    const [filial, zona, bolme] = [await siteTypeIdOf(s.tenantId), await siteTypeIdOf(s.tenantId, 'Zona'), await siteTypeIdOf(s.tenantId, 'Bölmə')];
    const code = (r: { body: { error?: { code: string } } }) => r.body.error?.code;
    expect(code(await owner.post('/api/v1/sites', { parentId: null, typeId: zona, name: 'Zona at the top' }))).toBe('SITE_LEVEL_INVALID');
    const a = (await owner.post('/api/v1/sites', { parentId: null, typeId: filial, name: 'A' })).body;
    const b = (await owner.post('/api/v1/sites', { parentId: null, typeId: filial, name: 'B' })).body;
    expect(code(await owner.post('/api/v1/sites', { parentId: a.id, typeId: filial, name: 'Filial in a filial' }))).toBe('SITE_LEVEL_INVALID');
    // Any lower level will do: a Bölmə right under a Filial is fine.
    const z = (await owner.post('/api/v1/sites', { parentId: a.id, typeId: zona, name: 'Z' })).body;
    const sec = (await owner.post('/api/v1/sites', { parentId: z.id, typeId: bolme, name: 'S' })).body;
    expect((await owner.post('/api/v1/sites', { parentId: a.id, typeId: bolme, name: 'S2' })).status).toBe(201);
    expect(code(await owner.post('/api/v1/sites', { parentId: sec.id, typeId: zona, name: 'Zona in a bölmə' }))).toBe('SITE_LEVEL_INVALID');
    // A type change must stay below the parent and above the children; a rename alone is always fine.
    expect(code(await owner.patch(`/api/v1/sites/${z.id}`, { typeId: bolme }))).toBe('SITE_LEVEL_INVALID');
    expect(code(await owner.patch(`/api/v1/sites/${sec.id}`, { typeId: zona }))).toBe('SITE_LEVEL_INVALID');
    expect((await owner.patch(`/api/v1/sites/${z.id}`, { name: 'Z2', typeId: zona })).status).toBe(200);
    // Moves follow the same rule: a filial cannot go under another, a zone can move to another filial.
    expect(code(await owner.post(`/api/v1/sites/${a.id}/move`, { parentId: b.id }))).toBe('SITE_LEVEL_INVALID');
    expect(code(await owner.post(`/api/v1/sites/${z.id}/move`, { parentId: sec.id }))).toBe('SITE_CYCLE');
    expect((await owner.post(`/api/v1/sites/${z.id}/move`, { parentId: b.id })).body).toMatchObject({ parentId: b.id });
  });

  it('keeps Filial as the root type and reorders the other levels (feedback 2026-11-27)', async () => {
    const s = await signupTenant(t);
    const owner = as(t, s.accessToken);
    const filial = await siteTypeIdOf(s.tenantId);
    const [zona, bolme, nokte] = [await siteTypeIdOf(s.tenantId, 'Zona'), await siteTypeIdOf(s.tenantId, 'Bölmə'), await siteTypeIdOf(s.tenantId, 'Yoxlama nöqtəsi')];
    expect((await owner.patch(`/api/v1/site-types/${filial}`, { active: false })).body.error.code).toBe('SITE_TYPE_ROOT');
    // A new type is the deepest level.
    const anbar = (await owner.post('/api/v1/site-types', { name: 'Anbar' })).body;
    expect(anbar.sortOrder).toBe(4);
    // The root is not in the list; a list that is not every other type once is refused.
    expect((await owner.post('/api/v1/site-types/order', { ids: [filial, zona, bolme, nokte, anbar.id] })).status).toBe(400);
    expect((await owner.post('/api/v1/site-types/order', { ids: [zona, bolme] })).status).toBe(400);
    const swapped = await owner.post('/api/v1/site-types/order', { ids: [anbar.id, zona, bolme, nokte] });
    expect(swapped.status, JSON.stringify(swapped.body)).toBe(200);
    expect(swapped.body.map((x: { name: string; sortOrder: number }) => `${x.sortOrder}:${x.name}`)).toEqual(['0:Filial', '1:Anbar', '2:Zona', '3:Bölmə', '4:Yoxlama nöqtəsi']);
    // With a zone holding a bölmə, putting Bölmə above Zona would leave a place inside a lower one.
    const a = (await owner.post('/api/v1/sites', { parentId: null, typeId: filial, name: 'A' })).body;
    const z = (await owner.post('/api/v1/sites', { parentId: a.id, typeId: zona, name: 'Z' })).body;
    await owner.post('/api/v1/sites', { parentId: z.id, typeId: bolme, name: 'S' });
    expect((await owner.post('/api/v1/site-types/order', { ids: [anbar.id, bolme, zona, nokte] })).body.error.code).toBe('SITE_TYPE_ORDER_CONFLICT');
    // A place that already broke the levels (made before them) does not block an order.
    await ownerQuery("update sites set type_id = $1 where name = 'S' and tenant_id = $2", [anbar.id, s.tenantId]);
    expect((await owner.post('/api/v1/site-types/order', { ids: [nokte, anbar.id, zona, bolme] })).status).toBe(200);
    const audit = await ownerQuery("select count(*)::int as n from audit_log where tenant_id = $1 and action = 'site_type.reordered'", [s.tenantId]);
    expect(audit.rows[0]).toEqual({ n: 2 });
  });

  it('rejects inactive or foreign site types', async () => {
    const s = await signupTenant(t);
    const other = await signupTenant(t);
    const owner = as(t, s.accessToken);
    const foreignType = await siteTypeIdOf(other.tenantId);
    expect((await owner.post('/api/v1/sites', { parentId: null, typeId: foreignType, name: 'X' })).status).toBe(422);
    const inactive = (await owner.post('/api/v1/site-types', { name: 'Old' })).body;
    await owner.patch(`/api/v1/site-types/${inactive.id}`, { active: false });
    expect((await owner.post('/api/v1/sites', { parentId: null, typeId: inactive.id, name: 'X' })).body.error.code).toBe(
      'REFERENCE_NOT_FOUND',
    );
  });

  it('enforces sites.view / sites.manage', async () => {
    const s = await signupTenant(t);
    const w = await createUserDirect(t, s.tenantId);
    const worker = as(t, (await loginWorker(t, s.orgCode, w.username!, w.secret)).accessToken);
    expect((await worker.get('/api/v1/sites')).status).toBe(403);
    const m = await createUserDirect(t, s.tenantId, { kind: 'staff', roleKey: 'manager' });
    const manager = as(t, (await loginStaff(t, m.email!, m.secret)).accessToken);
    expect((await manager.get('/api/v1/sites')).status).toBe(200);
    const typeId = await siteTypeIdOf(s.tenantId);
    expect((await manager.post('/api/v1/sites', { parentId: null, typeId, name: 'X' })).status).toBe(403);
  });

  it('returns 404 for unknown or malformed ids', async () => {
    const s = await signupTenant(t);
    const owner = as(t, s.accessToken);
    expect((await owner.patch('/api/v1/sites/not-a-uuid', { name: 'x' })).status).toBe(404);
    expect((await owner.patch('/api/v1/sites/0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e5f', { name: 'x' })).status).toBe(404);
  });
});
