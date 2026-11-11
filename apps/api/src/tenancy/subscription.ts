import {
  effectiveFeatures,
  effectiveLimits,
  FEATURES,
  type FeatureKey,
  localDateOf,
  PLAN_CATALOGUE,
  PLANS,
  type PlanKey,
  type Subscription,
  subscriptionState,
} from '@edildy/contracts';
import { eq, type SQL, sql } from 'drizzle-orm';
import { AppError } from '../common/app-error';
import type { Tx } from '../db/db.service';
import { tenants } from '../db/schema';

/** The tenant columns a subscription is computed from. */
export const subscriptionColumns = {
  plan: tenants.plan,
  planEndsOn: tenants.planEndsOn,
  branchLimit: tenants.branchLimit,
  extraFeatures: tenants.extraFeatures,
  staffLimitOverride: tenants.staffLimitOverride,
  workerLimitOverride: tenants.workerLimitOverride,
  timezone: tenants.timezone,
};

export interface SubscriptionRow {
  plan: PlanKey;
  planEndsOn: string | null;
  branchLimit: number;
  extraFeatures: string[];
  staffLimitOverride: number | null;
  workerLimitOverride: number | null;
  timezone: string;
}

export const isFeatureKey = (f: string): f is FeatureKey => (FEATURES as readonly string[]).includes(f);

/** The subscription as of `now`, with "today" taken in the organisation's time zone. */
export function subscriptionOf(row: SubscriptionRow, now = new Date()): Subscription {
  return {
    plan: row.plan,
    state: subscriptionState(row.planEndsOn, localDateOf(now, row.timezone)),
    endsOn: row.planEndsOn,
    features: effectiveFeatures(row.plan, row.extraFeatures.filter(isFeatureKey)),
    limits: effectiveLimits(row),
  };
}

/** SQL true for tenants (alias `t` by default) whose plan or add-ons include `feature`; for background jobs. */
export function tenantHasFeatureSql(feature: FeatureKey, alias = 't'): SQL {
  const plans = PLANS.filter((p) => PLAN_CATALOGUE[p].features.includes(feature));
  const t = sql.raw(alias);
  const inPlan = plans.length ? sql`${t}.plan in (${sql.join(plans.map((p) => sql`${p}`), sql`, `)})` : sql`false`;
  return sql`(${inPlan} or ${feature} = any(${t}.extra_features))`;
}

/** Whether the tenant has `feature` (reads the row through the caller's transaction). */
export async function tenantHasFeature(tx: Tx, tenantId: string, feature: FeatureKey): Promise<boolean> {
  const [row] = await tx.select(subscriptionColumns).from(tenants).where(eq(tenants.id, tenantId));
  return !!row && subscriptionOf(row).features.includes(feature);
}

export type LimitKind = 'staff' | 'workers' | 'branches';

const LIMIT_ERROR = { staff: 'STAFF_LIMIT_REACHED', workers: 'WORKER_LIMIT_REACHED', branches: 'BRANCH_LIMIT_REACHED' } as const;

/** What counts against each limit: staff = active + invited, workers = active, branches = active top-level sites. */
const usageSql: Record<LimitKind, SQL> = {
  staff: sql`select count(*)::int as n from users where kind = 'staff' and status in ('active', 'invited')`,
  workers: sql`select count(*)::int as n from users where kind = 'worker' and status = 'active'`,
  branches: sql`select count(*)::int as n from sites where parent_id is null and active`,
};

export async function usageOf(tx: Tx): Promise<Record<LimitKind, number>> {
  const r = await tx.execute<{ staff: number; workers: number; branches: number }>(sql`
    select (${usageSql.staff}) as staff, (${usageSql.workers}) as workers, (${usageSql.branches}) as branches`);
  const row = r.rows[0]!;
  return { staff: Number(row.staff), workers: Number(row.workers), branches: Number(row.branches) };
}

/**
 * Refuses one more `kind` when the plan's limit is already used up (BR-01.04/05). Locks the tenant row first, so
 * concurrent creates in one organisation are serialised and cannot both slip under the limit. Over-limit organisations
 * (after a downgrade) keep what they have; only adding more is refused.
 */
export async function assertWithinLimit(tx: Tx, tenantId: string, kind: LimitKind): Promise<void> {
  const [row] = await tx.select(subscriptionColumns).from(tenants).where(eq(tenants.id, tenantId)).for('update');
  if (!row) throw new AppError('NOT_FOUND');
  const limit = subscriptionOf(row).limits[kind];
  if (limit === null) return;
  const r = await tx.execute<{ n: number }>(usageSql[kind]);
  if (Number(r.rows[0]?.n ?? 0) >= limit) throw new AppError(LIMIT_ERROR[kind], { details: { limit } });
}
