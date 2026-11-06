import type { ProblemReportDto } from '@taskop/contracts';
import { uuidv7 } from 'uuidv7';
import { expect } from 'vitest';
import { DomainEvents } from '../src/common/domain-events';
import type { TestApp } from './app';
import { as, createUserDirect, loginStaff, loginWorker, type SignedUpTenant, signupTenant, siteTypeIdOf } from './fixtures';
import { ownerQuery } from './owner-db';
import type { Api } from './scheduling-fixtures';

export interface ReportUser {
  id: string;
  api: Api;
}

export interface ReportWorld {
  s: SignedUpTenant;
  owner: Api;
  /** Filial 1 and Filial 2. */
  siteId: string;
  otherSiteId: string;
  /** İşçi 1 at Filial 1, İşçi 2 at Filial 2, logged in on mobile. */
  workers: [ReportUser, ReportUser];
  /** Built-in managers (site_subtree, assignments.view + tasks.manage) at Filial 1 and Filial 2. */
  managerHere: ReportUser;
  managerThere: ReportUser;
  /** Built-in admin (all). */
  admin: ReportUser;
}

export async function reportWorld(t: TestApp): Promise<ReportWorld> {
  const s = await signupTenant(t);
  const owner = as(t, s.accessToken);
  const typeId = await siteTypeIdOf(s.tenantId);
  const siteId = (await owner.post('/api/v1/sites', { parentId: null, typeId, name: 'Filial 1' })).body.id as string;
  const otherSiteId = (await owner.post('/api/v1/sites', { parentId: null, typeId, name: 'Filial 2' })).body.id as string;
  const workers: ReportUser[] = [];
  for (const [fullName, site] of [['İşçi 1', siteId], ['İşçi 2', otherSiteId]] as const) {
    const u = await createUserDirect(t, s.tenantId, { fullName });
    expect((await owner.put(`/api/v1/users/${u.id}/sites`, { siteIds: [site] })).status).toBe(200);
    workers.push({ id: u.id, api: as(t, (await loginWorker(t, s.orgCode, u.username!, u.secret)).accessToken) });
  }
  const staff = async (roleKey: 'manager' | 'admin', fullName: string, sites: string[]): Promise<ReportUser> => {
    const u = await createUserDirect(t, s.tenantId, { kind: 'staff', roleKey, fullName, emailVerified: true });
    if (sites.length) expect((await owner.put(`/api/v1/users/${u.id}/sites`, { siteIds: sites })).status).toBe(200);
    return { id: u.id, api: as(t, (await loginStaff(t, u.email!, u.secret)).accessToken) };
  };
  return {
    s,
    owner,
    siteId,
    otherSiteId,
    workers: workers as [ReportUser, ReportUser],
    managerHere: await staff('manager', 'Menecer 1', [siteId]),
    managerThere: await staff('manager', 'Menecer 2', [otherSiteId]),
    admin: await staff('admin', 'Admin', []),
  };
}

export const LOCATION = { lat: 40.4093, lng: 49.8671, accuracyM: 12, capturedAt: '2026-11-02T04:00:00.000Z' };

export const newReportBody = (siteId: string, over: Record<string, unknown> = {}) => ({
  id: uuidv7(),
  siteId,
  severity: 'normal',
  text: 'Anbarın qapısı bağlanmır',
  location: LOCATION,
  reportedAt: '2026-11-02T04:00:00.000Z',
  ...over,
});

export async function createReport(api: Api, body: object): Promise<ProblemReportDto> {
  const res = await api.post('/api/v1/problem-reports', body);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as ProblemReportDto;
}

export async function reportAuditActions(reportId: string): Promise<string[]> {
  const r = await ownerQuery<{ action: string }>("select action from audit_log where entity_type = 'problem_report' and entity_id = $1 order by occurred_at, id", [reportId]);
  return r.rows.map((x) => x.action);
}

type ReportEventName = 'problem_report.created' | 'problem_report.closed' | 'problem_report.resolved';
const REPORT_EVENTS: ReportEventName[] = ['problem_report.created', 'problem_report.closed', 'problem_report.resolved'];

/** Records [event, reportId, actorUserId] for every problem_report.* event until `stop()`. */
export function captureReportEvents(t: TestApp) {
  const events = t.app.get(DomainEvents);
  const seen: Array<[ReportEventName, string, string | null]> = [];
  const offs = REPORT_EVENTS.map((name) => events.on(name, (e) => void seen.push([name, e.reportId, e.actorUserId])));
  return { seen, stop: () => offs.forEach((off) => off()) };
}
