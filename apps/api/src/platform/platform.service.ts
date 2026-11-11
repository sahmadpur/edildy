import { Inject, Injectable } from '@nestjs/common';
import { localDateOf, subscriptionState, type Page, type PlatformLoginResult, type PlatformTenantDetail, type PlatformTenantDto, type SubscriptionSettings } from '@edildy/contracts';
import { uuidv7 } from 'uuidv7';
import { and, asc, eq, gt, ilike, isNull, or, type SQL, sql } from 'drizzle-orm';
import { PasswordHasher } from '../auth/crypto/password-hasher';
import { TokenService } from '../auth/crypto/token.service';
import { CredentialService } from '../auth/credential.service';
import { RateLimitService } from '../auth/rate-limit.service';
import { AppError } from '../common/app-error';
import { currentRequestMeta } from '../common/request-context';
import { escapeLike } from '../common/sql';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { AuditService } from '../db/audit.service';
import { DbService } from '../db/db.service';
import { platformAdmins, roles, sessions, tenants, users } from '../db/schema';
import { seedTenantDefaults } from '../tenancy/bootstrap';
import { isFeatureKey, usageOf } from '../tenancy/subscription';
import type { CreateTenantDto, PlatformLoginDto, PlatformTenantListQueryDto } from './dto';

// Drizzle renders ${tenants.id} unqualified, which would bind to users.id inside the subquery.
const userCount = sql<number>`(select count(*)::int from users u where u.tenant_id = "tenants"."id")`;

@Injectable()
export class PlatformService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly rateLimit: RateLimitService,
    private readonly credentials: CredentialService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async login(input: PlatformLoginDto): Promise<PlatformLoginResult> {
    await this.rateLimit.consume(`platform-login:ip:${currentRequestMeta().ip}`, this.config.RL_LOGIN_IP_PER_MIN, 60);
    const [admin] = await this.db.platform.select().from(platformAdmins).where(eq(platformAdmins.email, input.email));
    const valid = await this.hasher.verify(admin?.active ? admin.credentialHash : null, input.password);
    if (!admin || !valid) throw new AppError('INVALID_CREDENTIALS');
    const { token, expiresAt } = await this.tokens.signPlatform(admin.id);
    return { accessToken: token, accessTokenExpiresAt: expiresAt.toISOString(), admin: { id: admin.id, email: admin.email, fullName: admin.fullName } };
  }

  async listTenants(q: PlatformTenantListQueryDto): Promise<Page<PlatformTenantDto>> {
    const conditions: (SQL | undefined)[] = [];
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      conditions.push(or(ilike(tenants.name, like), ilike(tenants.orgCode, like)));
    }
    if (q.cursor) conditions.push(gt(tenants.id, q.cursor));
    const rows = await this.db.platform
      .select({ tenant: tenants, userCount })
      .from(tenants)
      .where(and(...conditions))
      .orderBy(asc(tenants.id))
      .limit(q.limit + 1);
    const items = rows.slice(0, q.limit).map((r) => this.toDto(r.tenant, r.userCount));
    return { items, nextCursor: rows.length > q.limit ? items[items.length - 1]!.id : null };
  }

  async setStatus(adminId: string, tenantId: string, status: 'active' | 'suspended'): Promise<PlatformTenantDto> {
    const [before] = await this.db.platform.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!before) throw new AppError('NOT_FOUND');
    const [row] = await this.db.platform
      .update(tenants)
      .set({ status, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning({ tenant: tenants, userCount });
    if (status === 'suspended') {
      await this.db.platform
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.tenantId, tenantId), isNull(sessions.revokedAt)));
    }
    await this.audit.recordAsPlatform({
      tenantId,
      actorPlatformAdminId: adminId,
      action: status === 'suspended' ? 'tenant.suspended' : 'tenant.reactivated',
      entityType: 'tenant',
      entityId: tenantId,
      before: { status: before.status },
      after: { status },
    });
    return this.toDto(row!.tenant, row!.userCount);
  }

  /**
   * Creates an organisation (no self-registration): its defaults, the subscription and an invited Owner, who gets the
   * invitation e-mail and sets a password through it.
   */
  async createTenant(adminId: string, input: CreateTenantDto): Promise<PlatformTenantDetail> {
    const tenantId = uuidv7();
    const ownerId = uuidv7();
    await this.db.withTenant(
      tenantId,
      null,
      async (tx) => {
        const [tenant] = await tx
          .insert(tenants)
          .values({ id: tenantId, name: input.name, orgCode: input.orgCode, timezone: input.timezone, locale: input.locale, ...subscriptionValues(input.subscription) })
          .returning();
        const roleIds = await seedTenantDefaults(tx, tenantId);
        await tx.insert(users).values({
          id: ownerId,
          tenantId,
          fullName: input.owner.fullName,
          roleId: roleIds.owner,
          kind: 'staff',
          email: input.owner.email,
          status: 'invited',
        });
        await this.credentials.issueInvite({ tenantId, userId: ownerId, email: input.owner.email, fullName: input.owner.fullName });
        await this.audit.record({ action: 'tenant.created', entityType: 'tenant', entityId: tenantId, after: tenant });
        await this.audit.record({
          action: 'user.invited',
          entityType: 'user',
          entityId: ownerId,
          after: { fullName: input.owner.fullName, email: input.owner.email, role: 'owner', kind: 'staff' },
        });
      },
      { platformAdminId: adminId },
    );
    return this.getTenant(tenantId);
  }

  async getTenant(tenantId: string): Promise<PlatformTenantDetail> {
    const [row] = await this.db.platform.select({ tenant: tenants, userCount }).from(tenants).where(eq(tenants.id, tenantId));
    if (!row) throw new AppError('NOT_FOUND');
    const t = row.tenant;
    const { usage, owners } = await this.db.withTenant(tenantId, null, async (tx) => ({
      usage: await usageOf(tx),
      owners: await tx
        .select({ id: users.id, fullName: users.fullName, email: users.email, status: users.status })
        .from(users)
        .innerJoin(roles, eq(roles.id, users.roleId))
        .where(eq(roles.systemKey, 'owner'))
        .orderBy(asc(users.createdAt)),
    }));
    return {
      ...this.toDto(t, row.userCount),
      timezone: t.timezone,
      locale: t.locale,
      subscription: {
        plan: t.plan,
        period: t.planPeriod,
        startsOn: t.planStartsOn,
        endsOn: t.planEndsOn,
        branchLimit: t.branchLimit,
        extraFeatures: t.extraFeatures.filter(isFeatureKey),
        staffLimitOverride: t.staffLimitOverride,
        workerLimitOverride: t.workerLimitOverride,
      },
      usage,
      owners,
    };
  }

  /** Assigns the plan, period, dates, branches, add-ons and limit overrides (BR-01.02). */
  async setSubscription(adminId: string, tenantId: string, input: SubscriptionSettings): Promise<PlatformTenantDetail> {
    const before = await this.getTenant(tenantId);
    await this.db.platform
      .update(tenants)
      .set({
        ...subscriptionValues(input),
        // A new end date starts the expiry warnings afresh.
        ...(input.endsOn !== before.subscription.endsOn ? { expiryNotice: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));
    await this.audit.recordAsPlatform({
      tenantId,
      actorPlatformAdminId: adminId,
      action: 'tenant.subscription_changed',
      entityType: 'tenant',
      entityId: tenantId,
      before: before.subscription,
      after: input,
    });
    return this.getTenant(tenantId);
  }

  private toDto(t: typeof tenants.$inferSelect, count: number): PlatformTenantDto {
    return {
      id: t.id,
      name: t.name,
      orgCode: t.orgCode,
      status: t.status,
      userCount: count,
      plan: t.plan,
      endsOn: t.planEndsOn,
      subscriptionState: subscriptionState(t.planEndsOn, localDateOf(new Date(), t.timezone)),
      createdAt: t.createdAt.toISOString(),
    };
  }
}

function subscriptionValues(s: SubscriptionSettings) {
  return {
    plan: s.plan,
    planPeriod: s.period,
    planStartsOn: s.startsOn,
    planEndsOn: s.endsOn,
    branchLimit: s.branchLimit,
    extraFeatures: [...new Set(s.extraFeatures)],
    staffLimitOverride: s.staffLimitOverride,
    workerLimitOverride: s.workerLimitOverride,
  };
}
