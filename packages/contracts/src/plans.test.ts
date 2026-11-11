import { describe, expect, it } from 'vitest';
import { daysLeft, effectiveFeatures, effectiveLimits, PLAN_CATALOGUE, subscriptionInputSchema, subscriptionState } from './plans.js';

describe('plans', () => {
  it('matches the price table: each plan includes the previous one', () => {
    expect(PLAN_CATALOGUE.basic.features).toEqual([]);
    expect(PLAN_CATALOGUE.pro.features).toEqual(['notifications', 'usage_log']);
    expect(PLAN_CATALOGUE.enterprise.features).toEqual(['notifications', 'usage_log', 'problems', 'tasks', 'reports']);
    expect(PLAN_CATALOGUE.xl.features).toEqual(['notifications', 'usage_log', 'problems', 'tasks', 'reports', 'data_export', 'audits']);
    expect([PLAN_CATALOGUE.basic.staffLimit, PLAN_CATALOGUE.pro.staffLimit, PLAN_CATALOGUE.enterprise.staffLimit, PLAN_CATALOGUE.xl.staffLimit]).toEqual([5, 20, 50, null]);
    expect([PLAN_CATALOGUE.basic.workerLimit, PLAN_CATALOGUE.pro.workerLimit, PLAN_CATALOGUE.enterprise.workerLimit, PLAN_CATALOGUE.xl.workerLimit]).toEqual([10, 50, 100, null]);
  });

  it('adds add-ons to the plan, in catalogue order, without duplicates', () => {
    expect(effectiveFeatures('pro', ['tasks', 'notifications'])).toEqual(['notifications', 'usage_log', 'tasks']);
    expect(effectiveFeatures('basic', [])).toEqual([]);
  });

  it('lets overrides replace the plan limits', () => {
    expect(effectiveLimits({ plan: 'pro', branchLimit: 3, staffLimitOverride: null, workerLimitOverride: 80 })).toEqual({ staff: 20, workers: 80, branches: 3 });
  });

  it('is active through the end date, in grace for 7 days, then expired', () => {
    expect(subscriptionState(null, '2026-11-11')).toBe('active');
    expect(subscriptionState('2026-11-11', '2026-11-11')).toBe('active');
    expect(subscriptionState('2026-11-11', '2026-11-12')).toBe('grace');
    expect(subscriptionState('2026-11-11', '2026-11-18')).toBe('grace');
    expect(subscriptionState('2026-11-11', '2026-11-19')).toBe('expired');
    expect(daysLeft('2026-11-25', '2026-11-11')).toBe(14);
    expect(daysLeft(null, '2026-11-11')).toBeNull();
  });

  it('refuses an end date before the start', () => {
    const base = { plan: 'xl', period: 'yearly', startsOn: '2026-11-11', branchLimit: 1, extraFeatures: [], staffLimitOverride: null, workerLimitOverride: null } as const;
    expect(subscriptionInputSchema.safeParse({ ...base, endsOn: '2026-11-10' }).success).toBe(false);
    expect(subscriptionInputSchema.safeParse({ ...base, endsOn: null }).success).toBe(true);
  });
});
