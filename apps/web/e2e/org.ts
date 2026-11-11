import { type APIRequestContext, expect } from '@playwright/test';

/** The platform admin CI creates before the run (create-platform-admin.ts); organisations are made by Edildy staff only. */
export const PLATFORM_ADMIN = {
  email: process.env.E2E_PLATFORM_EMAIL ?? 'e2e-admin@edildy.test',
  password: process.env.E2E_PLATFORM_PASSWORD ?? 'e2e platform password',
};
export const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

export const today = () => new Date().toISOString().slice(0, 10);

export async function platformToken(request: APIRequestContext): Promise<string> {
  const res = await request.post('/api/v1/platform/auth/login', { data: PLATFORM_ADMIN });
  expect(res.ok(), await res.text()).toBeTruthy();
  return ((await res.json()) as { accessToken: string }).accessToken;
}

/** The token of the latest invitation e-mail to `email`, read from Mailpit. */
export async function inviteToken(request: APIRequestContext, email: string): Promise<string> {
  let token: string | null = null;
  await expect
    .poll(
      async () => {
        const search = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
        if (!search.ok()) return null;
        const { messages } = (await search.json()) as { messages: Array<{ ID: string }> };
        if (!messages[0]) return null;
        const message = (await (await request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string };
        token = /accept-invite\?token=([^\s&]+)/.exec(message.Text)?.[1] ?? null;
        return token;
      },
      { timeout: 30_000, intervals: [500, 1_000] },
    )
    .not.toBeNull();
  return decodeURIComponent(token!);
}

/**
 * An organisation created by the platform admin (XL unless `plan` says otherwise), whose owner accepted the
 * invitation: returns the owner's credentials and access token, as self-registration once did.
 */
export async function createOrg(
  request: APIRequestContext,
  o: { name: string; orgCode: string; email: string; password: string; fullName?: string; plan?: 'basic' | 'pro' | 'enterprise' | 'xl' },
): Promise<{ email: string; password: string; accessToken: string }> {
  const admin = await platformToken(request);
  const res = await request.post('/api/v1/platform/tenants', {
    headers: { Authorization: `Bearer ${admin}` },
    data: {
      name: o.name,
      orgCode: o.orgCode,
      timezone: 'Asia/Baku',
      locale: 'az',
      owner: { fullName: o.fullName ?? 'Elvin Əhmədov', email: o.email },
      subscription: { plan: o.plan ?? 'xl', period: 'yearly', startsOn: today(), endsOn: null, branchLimit: 10, extraFeatures: [], staffLimitOverride: null, workerLimitOverride: null },
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const accept = await request.post('/api/v1/auth/invite/accept', { data: { token: await inviteToken(request, o.email), password: o.password, client: 'mobile' } });
  expect(accept.ok(), await accept.text()).toBeTruthy();
  return { email: o.email, password: o.password, accessToken: ((await accept.json()) as { accessToken: string }).accessToken };
}
