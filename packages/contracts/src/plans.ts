import { z } from 'zod';
import type { PermissionKey } from './permissions.js';
import { dayNumber, localDateSchema, type LocalDate } from './scheduling-time.js';

/**
 * Subscription plans (BR-01). Edildy staff assign a plan per organisation by hand; there are no payments in the app.
 * The catalogue lives in code: a price or limit change ships with a deploy.
 */
export const PLANS = ['basic', 'pro', 'enterprise', 'xl'] as const;
export type PlanKey = (typeof PLANS)[number];
export const planSchema = z.enum(PLANS);

/** Feature areas a plan can switch off. Everything else (checklists, scheduling, runs, dashboard, users, sites…) is core. */
export const FEATURES = ['notifications', 'usage_log', 'problems', 'tasks', 'reports', 'data_export', 'audits'] as const;
export type FeatureKey = (typeof FEATURES)[number];
export const featureSchema = z.enum(FEATURES);

/**
 * Permissions that only make sense with a feature: the roles editor hides them when the plan lacks it. reports.view
 * is absent on purpose: the home dashboard (core) needs it.
 */
export const FEATURE_PERMISSIONS: Partial<Record<FeatureKey, readonly PermissionKey[]>> = {
  notifications: ['notifications.manage', 'notifications.send'],
  usage_log: ['audit.view'],
  tasks: ['tasks.view', 'tasks.manage'],
  data_export: ['reports.export'],
  audits: ['executions.correct', 'audits.perform'],
};

/** The permission keys to offer for a set of enabled features. */
export function permissionsOffered(all: readonly PermissionKey[], features: readonly FeatureKey[]): PermissionKey[] {
  const hidden = new Set(FEATURES.filter((f) => !features.includes(f)).flatMap((f) => FEATURE_PERMISSIONS[f] ?? []));
  return all.filter((k) => !hidden.has(k));
}

export const PLAN_PERIODS = ['monthly', 'quarterly', 'half_year', 'yearly'] as const;
export type PlanPeriod = (typeof PLAN_PERIODS)[number];
export const planPeriodSchema = z.enum(PLAN_PERIODS);

export interface PlanDefinition {
  /** Web staff accounts (active + invited); null = unlimited. */
  staffLimit: number | null;
  /** Phone workers (active); null = unlimited. */
  workerLimit: number | null;
  features: readonly FeatureKey[];
  /** AZN per month for the first branch, and for each further one. Shown to Edildy staff only. */
  pricePerBranch: number;
  extraBranchPrice: number;
}

export const PLAN_CATALOGUE: Record<PlanKey, PlanDefinition> = {
  basic: { staffLimit: 5, workerLimit: 10, features: [], pricePerBranch: 20, extraBranchPrice: 5 },
  pro: { staffLimit: 20, workerLimit: 50, features: ['notifications', 'usage_log'], pricePerBranch: 50, extraBranchPrice: 20 },
  enterprise: {
    staffLimit: 50,
    workerLimit: 100,
    features: ['notifications', 'usage_log', 'problems', 'tasks', 'reports'],
    pricePerBranch: 100,
    extraBranchPrice: 50,
  },
  xl: { staffLimit: null, workerLimit: null, features: [...FEATURES], pricePerBranch: 200, extraBranchPrice: 100 },
};

/** Days after the end date during which everything still works (with a warning). Then the organisation is read-only. */
export const SUBSCRIPTION_GRACE_DAYS = 7;
/** Days before the end date on which the owners are e-mailed. */
export const SUBSCRIPTION_WARNING_DAYS = [14, 7, 1] as const;

export const SUBSCRIPTION_STATES = ['active', 'grace', 'expired'] as const;
export type SubscriptionState = (typeof SUBSCRIPTION_STATES)[number];

/** `active` until the end date (inclusive), `grace` for SUBSCRIPTION_GRACE_DAYS after it, then `expired`. No end date = active. */
export function subscriptionState(endsOn: LocalDate | null, today: LocalDate): SubscriptionState {
  if (endsOn === null) return 'active';
  const over = dayNumber(today) - dayNumber(endsOn);
  if (over <= 0) return 'active';
  return over <= SUBSCRIPTION_GRACE_DAYS ? 'grace' : 'expired';
}

/** Days from `today` to the end date (0 on the last day, negative after it); null without an end date. */
export function daysLeft(endsOn: LocalDate | null, today: LocalDate): number | null {
  return endsOn === null ? null : dayNumber(endsOn) - dayNumber(today);
}

/** The plan's features plus add-ons, in FEATURES order. */
export function effectiveFeatures(plan: PlanKey, extra: readonly FeatureKey[]): FeatureKey[] {
  const on = new Set<FeatureKey>([...PLAN_CATALOGUE[plan].features, ...extra]);
  return FEATURES.filter((f) => on.has(f));
}

export const subscriptionLimitsSchema = z.object({
  staff: z.number().int().nullable(),
  workers: z.number().int().nullable(),
  branches: z.number().int(),
});
export type SubscriptionLimits = z.infer<typeof subscriptionLimitsSchema>;

export function effectiveLimits(s: { plan: PlanKey; branchLimit: number; staffLimitOverride: number | null; workerLimitOverride: number | null }): SubscriptionLimits {
  const def = PLAN_CATALOGUE[s.plan];
  return { staff: s.staffLimitOverride ?? def.staffLimit, workers: s.workerLimitOverride ?? def.workerLimit, branches: s.branchLimit };
}

/** What every signed-in client receives (in `me.tenant.subscription`). */
export const subscriptionSchema = z.object({
  plan: planSchema,
  state: z.enum(SUBSCRIPTION_STATES),
  endsOn: localDateSchema.nullable(),
  features: z.array(featureSchema),
  limits: subscriptionLimitsSchema,
});
export type Subscription = z.infer<typeof subscriptionSchema>;

/** What Edildy staff set for an organisation. */
export const subscriptionInputSchema = z
  .object({
    plan: planSchema,
    period: planPeriodSchema,
    startsOn: localDateSchema,
    endsOn: localDateSchema.nullable(),
    branchLimit: z.number().int().min(1).max(10_000),
    extraFeatures: z.array(featureSchema).max(FEATURES.length),
    staffLimitOverride: z.number().int().min(1).max(100_000).nullable(),
    workerLimitOverride: z.number().int().min(1).max(100_000).nullable(),
  })
  .refine((s) => s.endsOn === null || dayNumber(s.endsOn) >= dayNumber(s.startsOn), { error: 'errors.validation.invalid', path: ['endsOn'] });
export type SubscriptionInput = z.input<typeof subscriptionInputSchema>;
export type SubscriptionSettings = z.infer<typeof subscriptionInputSchema>;

export const subscriptionUsageSchema = z.object({ staff: z.number().int(), workers: z.number().int(), branches: z.number().int() });
export type SubscriptionUsage = z.infer<typeof subscriptionUsageSchema>;

/** The organisation's own view (Settings → Subscription): the plan, the limits and how much of them is used. */
export const tenantSubscriptionDtoSchema = subscriptionSchema.extend({
  period: planPeriodSchema,
  startsOn: localDateSchema,
  usage: subscriptionUsageSchema,
});
export type TenantSubscriptionDto = z.infer<typeof tenantSubscriptionDtoSchema>;
