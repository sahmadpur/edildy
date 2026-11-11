import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './app';
import { signupTenant, uniq } from './fixtures';
import { ownerQuery } from './owner-db';

describe('no self-registration', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('has no signup route: organisations are created by Edildy staff', async () => {
    const orgCode = uniq('org');
    const res = await t.http().post('/api/v1/auth/signup').send({ orgName: 'MM', orgCode, fullName: 'X Y', email: `${orgCode}@m.az`, password: 'long password 1', client: 'web' });
    expect(res.status).toBe(404);
    expect((await ownerQuery('select 1 from tenants where org_code = $1', [orgCode])).rows).toHaveLength(0);
  });
});

describe('POST /auth/verify-email', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('verifies once with the mailed token', async () => {
    const s = await signupTenant(t);
    const token = t.mailer.tokenFor(s.email);
    expect((await t.http().post('/api/v1/auth/verify-email').send({ token })).status).toBe(204);
    const row = await ownerQuery('select email_verified_at from users where id = $1', [s.ownerId]);
    expect(row.rows[0]?.email_verified_at).not.toBeNull();

    const again = await t.http().post('/api/v1/auth/verify-email').send({ token });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('TOKEN_INVALID');
  });

  it('rejects garbage tokens', async () => {
    const res = await t.http().post('/api/v1/auth/verify-email').send({ token: 'garbage-token-value' });
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });
});
