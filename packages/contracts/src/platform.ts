import { z } from 'zod';
import { cursorQuerySchema, idSchema, isoDateTimeSchema } from './common.js';
import { emailSchema, orgCodeSchema } from './credentials.js';
import { planPeriodSchema, planSchema, SUBSCRIPTION_STATES, subscriptionInputSchema, subscriptionUsageSchema } from './plans.js';
import { localDateSchema } from './scheduling-time.js';
import { localeSchema, timezoneSchema } from './tenant.js';

export const platformLoginInputSchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(254),
  password: z.string().min(1).max(128),
});
export type PlatformLoginInput = z.input<typeof platformLoginInputSchema>;

export const platformLoginResultSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: isoDateTimeSchema,
  admin: z.object({ id: idSchema, email: z.string(), fullName: z.string() }),
});
export type PlatformLoginResult = z.infer<typeof platformLoginResultSchema>;

export const platformTenantDtoSchema = z.object({
  id: idSchema,
  name: z.string(),
  orgCode: z.string(),
  status: z.enum(['active', 'suspended']),
  userCount: z.number().int(),
  plan: planSchema,
  endsOn: localDateSchema.nullable(),
  subscriptionState: z.enum(SUBSCRIPTION_STATES),
  createdAt: isoDateTimeSchema,
});
export type PlatformTenantDto = z.infer<typeof platformTenantDtoSchema>;

export const platformTenantListQuerySchema = cursorQuerySchema.extend({ q: z.string().trim().max(100).optional() });
export type PlatformTenantListQuery = z.input<typeof platformTenantListQuerySchema>;

/** An organisation as Edildy staff see it: the list row plus what they set (subscription) and what is used. */
export const platformTenantDetailSchema = platformTenantDtoSchema.extend({
  timezone: z.string(),
  locale: z.string(),
  subscription: z.object({
    plan: planSchema,
    period: planPeriodSchema,
    startsOn: localDateSchema,
    endsOn: localDateSchema.nullable(),
    branchLimit: z.number().int(),
    extraFeatures: subscriptionInputSchema.shape.extraFeatures,
    staffLimitOverride: z.number().int().nullable(),
    workerLimitOverride: z.number().int().nullable(),
  }),
  usage: subscriptionUsageSchema,
  owners: z.array(z.object({ id: idSchema, fullName: z.string(), email: z.string().nullable(), status: z.enum(['active', 'deactivated', 'invited']) })),
});
export type PlatformTenantDetail = z.infer<typeof platformTenantDetailSchema>;

/** Organisations are created by Edildy staff only (no self-registration); the owner gets an invitation e-mail. */
export const createTenantInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  orgCode: orgCodeSchema,
  timezone: timezoneSchema,
  locale: localeSchema,
  owner: z.object({ fullName: z.string().trim().min(2).max(120), email: emailSchema }),
  subscription: subscriptionInputSchema,
});
export type CreateTenantInput = z.input<typeof createTenantInputSchema>;
