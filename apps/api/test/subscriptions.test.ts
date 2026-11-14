import { hash } from '@node-rs/argon2';
import { addDays, localDateOf } from '@edildy/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DbService } from '../src/db/db.service';
import { AuditLookup } from '../src/executions/audit-lookup';
import { dueNotice, SubscriptionJobs } from '../src/tenancy/subscription-jobs';
import { createTestApp, type TestApp } from './app';
import { as, createUserDirect, signupTenant, siteTypeIdOf, uniq } from './fixtures';
import { ownerQuery } from './owner-db';

const today = () => localDateOf(new Date(), 'Asia/Baku');
const sub = (over: Record<string, unknown> = {}) => ({
  plan: 'basic',
  period: 'monthly',
  startsOn: today(),
  endsOn: null,
  branchLimit: 1,
  extraFeatures: [],
  staffLimitOverride: null,
  workerLimitOverride: null,
  ...over,
});

describe('subscriptions', () => {
  let t: TestApp;
  let platform: ReturnType<typeof as>;

  beforeAll(async () => {
    t = await createTestApp();
    const email = `${uniq('admin')}@edildy.az`;
    await ownerQuery("insert into platform_admins (id, email, credential_hash, full_name) values (gen_random_uuid(), $1, $2, 'Support')", [
      email,
      await hash('platform password 1', { memoryCost: 1024, timeCost: 1, parallelism: 1 }),
    ]);
    const res = await t.http().post('/api/v1/platform/auth/login').send({ email, password: 'platform password 1' });
    platform = as(t, res.body.accessToken);
  });
  afterAll(() => t.close());

  /** An organisation on `plan` (via the platform admin) with its Owner signed in. */
  async function orgOn(plan: string, over: Record<string, unknown> = {}) {
    const s = await signupTenant(t, { client: 'web' });
    const res = await platform.put(`/api/v1/platform/tenants/${s.tenantId}/subscription`, sub({ plan, ...over }));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return s;
  }

  describe('platform admin', () => {
    it('creates an organisation with an invited Owner and the chosen plan', async () => {
      const orgCode = uniq('org');
      const email = `${orgCode}@example.az`;
      const res = await platform.post('/api/v1/platform/tenants', {
        name: 'Bakı Market',
        orgCode,
        timezone: 'Asia/Baku',
        locale: 'az',
        owner: { fullName: 'Leyla Məmmədova', email },
        subscription: sub({ plan: 'pro', period: 'yearly', endsOn: addDays(today(), 365), branchLimit: 3, extraFeatures: ['tasks'] }),
      });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(res.body).toMatchObject({
        orgCode,
        plan: 'pro',
        subscriptionState: 'active',
        subscription: { plan: 'pro', period: 'yearly', branchLimit: 3, extraFeatures: ['tasks'] },
        // Every new organisation starts with one branch (feedback 2026-11-14).
        usage: { staff: 1, workers: 0, branches: 1 },
        owners: [{ fullName: 'Leyla Məmmədova', email, status: 'invited' }],
      });
      // The owner sets a password through the invitation and signs in on Pro + Tasks.
      const accept = await t.http().post('/api/v1/auth/invite/accept').send({ token: t.mailer.tokenFor(email), password: 'owner password 1', client: 'web' });
      expect(accept.status, JSON.stringify(accept.body)).toBe(200);
      expect(accept.body.me.tenant.subscription).toMatchObject({ plan: 'pro', state: 'active', features: ['notifications', 'usage_log', 'tasks'], limits: { staff: 20, workers: 50, branches: 3 } });
      const audit = await ownerQuery("select action from audit_log where tenant_id = $1 order by occurred_at", [res.body.id]);
      expect(audit.rows.map((r) => r.action)).toEqual(expect.arrayContaining(['tenant.created', 'user.invited']));
    });

    it('refuses a taken org code and a taken owner e-mail', async () => {
      const s = await signupTenant(t);
      const base = { name: 'X Y', timezone: 'Asia/Baku', locale: 'az', subscription: sub() };
      const code = await platform.post('/api/v1/platform/tenants', { ...base, orgCode: s.orgCode, owner: { fullName: 'A B', email: `${uniq('e')}@x.az` } });
      expect(code.body.error.code).toBe('ORG_CODE_TAKEN');
      const mail = await platform.post('/api/v1/platform/tenants', { ...base, orgCode: uniq('org'), owner: { fullName: 'A B', email: s.email } });
      expect(mail.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('changes the plan, audits it, and shows it in the list', async () => {
      const s = await orgOn('enterprise', { endsOn: addDays(today(), 30), staffLimitOverride: 70 });
      const detail = await platform.get(`/api/v1/platform/tenants/${s.tenantId}`);
      expect(detail.body.subscription).toMatchObject({ plan: 'enterprise', staffLimitOverride: 70 });
      const list = await platform.get(`/api/v1/platform/tenants?q=${s.orgCode}`);
      expect(list.body.items[0]).toMatchObject({ plan: 'enterprise', endsOn: addDays(today(), 30), subscriptionState: 'active' });
      const audit = await ownerQuery("select actor_platform_admin_id from audit_log where tenant_id = $1 and action = 'tenant.subscription_changed'", [s.tenantId]);
      expect(audit.rows[0]?.actor_platform_admin_id).toBeTruthy();
      const me = await as(t, s.accessToken).get('/api/v1/me');
      expect(me.body.tenant.subscription.limits).toEqual({ staff: 70, workers: 100, branches: 1 });
    });

    it('shows what the organisation has set up and how it is used', async () => {
      const s = await signupTenant(t, { client: 'web' });
      await as(t, s.accessToken).post('/api/v1/teams', { name: 'Activity team' });
      const detail = await platform.get(`/api/v1/platform/tenants/${s.tenantId}`);
      expect(detail.body.counts).toEqual({ sites: 0, teams: 1, checklists: 0, assignments: 0 });
      expect(detail.body.lastActivityAt).not.toBeNull();

      const res = await platform.get(`/api/v1/platform/tenants/${s.tenantId}/activity`);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body).toMatchObject({ activeUsers: { d7: 1, d30: 1 }, activeByClient: { web: 1, mobile: 0 }, logins: { d7: 1, d30: 1 }, runsCompleted: { d7: 0, d30: 0 } });
      expect(res.body.daily).toHaveLength(30);
      expect(res.body.daily.at(-1)).toMatchObject({ users: 1 });
      expect(res.body.daily.at(-1).actions).toBeGreaterThanOrEqual(2);
      expect(res.body.recent[0]).toMatchObject({ action: 'team.created', actor: { type: 'user', id: s.ownerId } });
      // Another organisation's activity is not mixed in.
      const other = await signupTenant(t);
      expect((await platform.get(`/api/v1/platform/tenants/${other.tenantId}/activity`)).body.recent.map((e: { action: string }) => e.action)).not.toContain('team.created');
    });

    it('refuses an end date before the start', async () => {
      const s = await signupTenant(t);
      const res = await platform.put(`/api/v1/platform/tenants/${s.tenantId}/subscription`, sub({ endsOn: addDays(today(), -1) }));
      expect(res.status).toBe(400);
    });
  });

  describe('features', () => {
    it('Basic: refuses tasks, problems, reports, usage log, audits, notifications and export; keeps the dashboard', async () => {
      const s = await orgOn('basic');
      const api = as(t, s.accessToken);
      for (const url of ['/api/v1/tasks', '/api/v1/problems', '/api/v1/problem-reports', '/api/v1/reports/sites?from=2026-11-01&to=2026-11-02', '/api/v1/audit-log', '/api/v1/audits', '/api/v1/me/notifications', '/api/v1/notification-rules', '/api/v1/reports/runs/export?from=2026-11-01&to=2026-11-02&format=csv']) {
        const res = await api.get(url);
        expect(res.status, url).toBe(403);
        expect(res.body.error.code, url).toBe('FEATURE_NOT_IN_PLAN');
      }
      expect((await api.get('/api/v1/reports/summary?from=2026-11-01&to=2026-11-02')).status).toBe(200);
      expect((await api.get('/api/v1/checklists')).status).toBe(200);
    });

    it('turns a feature on through an add-on', async () => {
      const s = await orgOn('basic', { extraFeatures: ['tasks'] });
      expect((await as(t, s.accessToken).get('/api/v1/tasks')).status).toBe(200);
      expect((await as(t, s.accessToken).get('/api/v1/problems')).status).toBe(403);
    });

    it('hides permissions of missing features from the roles editor', async () => {
      const s = await orgOn('pro');
      const res = await as(t, s.accessToken).get('/api/v1/permissions');
      const keys = res.body.flatMap((g: { keys: string[] }) => g.keys);
      expect(keys).toEqual(expect.arrayContaining(['notifications.send', 'audit.view', 'reports.view']));
      expect(keys).not.toEqual(expect.arrayContaining(['tasks.view']));
      expect(keys).not.toContain('audits.perform');
      expect(keys).not.toContain('reports.export');
    });

    it('syncs no tasks or problem reports to phones without those features, and drops known ones', async () => {
      const s = await orgOn('pro');
      const w = await createUserDirect(t, s.tenantId);
      const login = await t.http().post('/api/v1/auth/login/worker').send({ orgCode: s.orgCode, username: w.username, secret: w.secret, client: 'mobile' });
      const known = '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e5f';
      const res = await as(t, login.body.accessToken).get(`/api/v1/me/sync?knownTaskIds=${known}&knownProblemReportIds=${known}`);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body).toMatchObject({ tasks: [], removedTaskIds: [known], problemReports: [], removedProblemReportIds: [known], reportSites: [] });
    });

    it('ignores "requires audit" on organisations without audits', async () => {
      const lookup = t.app.get(AuditLookup);
      for (const [plan, expected] of [['enterprise', false], ['xl', true]] as const) {
        const s = await orgOn(plan);
        const c = await as(t, s.accessToken).post('/api/v1/checklists', { name: uniq('Checklist') });
        expect(c.status, JSON.stringify(c.body)).toBe(201);
        await ownerQuery('update checklists set requires_audit = true where id = $1', [c.body.id]);
        const required = await t.app.get(DbService).withTenant(s.tenantId, null, () => lookup.requiresAudit(c.body.id));
        expect(required, plan).toBe(expected);
      }
    });
  });

  describe('limits', () => {
    it('caps workers and staff, counting invitations, and blocks reactivation over the limit', async () => {
      const s = await orgOn('basic', { workerLimitOverride: 2, staffLimitOverride: 2 });
      await t.http().post('/api/v1/auth/verify-email').send({ token: t.mailer.tokenFor(s.email) });
      const api = as(t, s.accessToken);
      const workerRole = (await ownerQuery<{ id: string }>("select id from roles where tenant_id = $1 and system_key = 'worker'", [s.tenantId])).rows[0]!.id;
      const managerRole = (await ownerQuery<{ id: string }>("select id from roles where tenant_id = $1 and system_key = 'manager'", [s.tenantId])).rows[0]!.id;
      const worker = (n: number) => ({ fullName: `Worker ${n}`, username: uniq('w'), credentialKind: 'pin', roleId: workerRole, siteIds: [], teamIds: [] });
      const first = await api.post('/api/v1/users/workers', worker(1));
      expect(first.status, JSON.stringify(first.body)).toBe(201);
      expect((await api.post('/api/v1/users/workers', worker(2))).status).toBe(201);
      const third = await api.post('/api/v1/users/workers', worker(3));
      expect(third.status).toBe(409);
      expect(third.body.error).toMatchObject({ code: 'WORKER_LIMIT_REACHED', limit: 2 });

      // Owner + one invitation = 2 staff.
      expect((await api.post('/api/v1/users/invite', { fullName: 'Manager One', email: `${uniq('m')}@x.az`, roleId: managerRole, siteIds: [], teamIds: [] })).status).toBe(201);
      const staff = await api.post('/api/v1/users/invite', { fullName: 'Manager Two', email: `${uniq('m')}@x.az`, roleId: managerRole, siteIds: [], teamIds: [] });
      expect(staff.body.error).toMatchObject({ code: 'STAFF_LIMIT_REACHED', limit: 2 });

      // Deactivating frees a place; reactivating while full is refused.
      const id = first.body.user.id;
      expect((await api.post(`/api/v1/users/${id}/deactivate`)).status).toBe(200);
      expect((await api.post('/api/v1/users/workers', worker(4))).status).toBe(201);
      const back = await api.post(`/api/v1/users/${id}/reactivate`);
      expect(back.body.error.code).toBe('WORKER_LIMIT_REACHED');
    });

    it('caps branches (top-level sites) on create, reactivate and move; sub-sites are free', async () => {
      const s = await orgOn('basic', { branchLimit: 1 });
      const api = as(t, s.accessToken);
      const typeId = await siteTypeIdOf(s.tenantId);
      const a = await api.post('/api/v1/sites', { name: 'Filial 1', typeId, parentId: null });
      expect(a.status, JSON.stringify(a.body)).toBe(201);
      const child = await api.post('/api/v1/sites', { name: 'Zona', typeId, parentId: a.body.id });
      expect(child.status).toBe(201);
      const b = await api.post('/api/v1/sites', { name: 'Filial 2', typeId, parentId: null });
      expect(b.body.error).toMatchObject({ code: 'BRANCH_LIMIT_REACHED', limit: 1 });
      const moved = await api.post(`/api/v1/sites/${child.body.id}/move`, { parentId: null });
      expect(moved.body.error.code).toBe('BRANCH_LIMIT_REACHED');
      expect((await api.patch(`/api/v1/sites/${a.body.id}`, { active: false })).status).toBe(200);
      expect((await api.post('/api/v1/sites', { name: 'Filial 3', typeId, parentId: null })).status).toBe(201);
      expect((await api.patch(`/api/v1/sites/${a.body.id}`, { active: true })).body.error.code).toBe('BRANCH_LIMIT_REACHED');
    });

    it('serialises concurrent creates at the limit', async () => {
      const s = await orgOn('basic', { workerLimitOverride: 1 });
      const api = as(t, s.accessToken);
      const workerRole = (await ownerQuery<{ id: string }>("select id from roles where tenant_id = $1 and system_key = 'worker'", [s.tenantId])).rows[0]!.id;
      const make = () => api.post('/api/v1/users/workers', { fullName: 'Racer', username: uniq('w'), credentialKind: 'pin', roleId: workerRole, siteIds: [], teamIds: [] });
      const results = await Promise.all([make(), make(), make()]);
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    });
  });

  describe('end date', () => {
    it('keeps working in the grace period, then becomes read-only (writes refused, reads and sign-out allowed)', async () => {
      const grace = await orgOn('xl', { startsOn: addDays(today(), -40), endsOn: addDays(today(), -3) });
      const g = await as(t, grace.accessToken).get('/api/v1/me');
      expect(g.body.tenant.subscription).toMatchObject({ state: 'grace' });
      expect((await as(t, grace.accessToken).post('/api/v1/teams', { name: 'Grace team' })).status).toBe(201);

      const expired = await orgOn('xl', { startsOn: addDays(today(), -40), endsOn: addDays(today(), -8) });
      const api = as(t, expired.accessToken);
      expect((await api.get('/api/v1/me')).body.tenant.subscription.state).toBe('expired');
      const write = await api.post('/api/v1/teams', { name: 'Late team' });
      expect(write.status).toBe(403);
      expect(write.body.error.code).toBe('SUBSCRIPTION_EXPIRED');
      expect((await api.get('/api/v1/teams')).status).toBe(200);
      expect((await api.post('/api/v1/auth/logout')).status).toBe(204);
    });

    it('picks the warning steps 14/7/1 and "ended" through the grace period', () => {
      expect([20, 14, 10, 7, 3, 1, 0, -1, -7, -8].map(dueNotice)).toEqual([null, 14, 14, 7, 7, 1, 1, 'ended', 'ended', null]);
    });

    it('e-mails the active owners once per step', async () => {
      const s = await orgOn('pro', { endsOn: addDays(today(), 7) });
      await t.http().post('/api/v1/auth/verify-email').send({ token: t.mailer.tokenFor(s.email) });
      const jobs = t.app.get(SubscriptionJobs);
      const before = t.mailer.sent.length;
      await jobs.notifyAll([s.tenantId]);
      const mail = t.mailer.lastTo(s.email);
      expect(t.mailer.sent.length).toBe(before + 1);
      expect(mail?.subject).toContain('abunəliyi');
      expect(mail?.text).toContain('Qalan gün: 7');
      await jobs.notifyAll([s.tenantId]);
      expect(t.mailer.sent.length).toBe(before + 1);
    });
  });
});
