import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { FeatureKey, PermissionKey } from '@edildy/contracts';
import { AppError } from './app-error';
import type { AppRequest, Principal } from './request';

export const IS_PUBLIC_KEY = 'edildy:isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const REQUIRED_PERMISSIONS_KEY = 'edildy:requiredPermissions';
/** Every key of a list is needed; with `{ any }`, one of them is enough. */
export type PermissionRequirement = PermissionKey[] | { any: PermissionKey[] };
export const RequirePermission = (...keys: PermissionKey[]) => SetMetadata(REQUIRED_PERMISSIONS_KEY, keys satisfies PermissionRequirement);
/** One of `keys` is enough, e.g. the run drawer: assignments.view or reports.view (SP7 spec §5.6). */
export const RequireAnyPermission = (...keys: [PermissionKey, ...PermissionKey[]]) => SetMetadata(REQUIRED_PERMISSIONS_KEY, { any: keys } satisfies PermissionRequirement);

export const REQUIRED_FEATURE_KEY = 'edildy:requiredFeature';
/** The route belongs to a feature area the organisation's plan must include (BR-01.03); refused with FEATURE_NOT_IN_PLAN. */
export const RequireFeature = (feature: FeatureKey) => SetMetadata(REQUIRED_FEATURE_KEY, feature);

export const ALLOW_WHEN_EXPIRED_KEY = 'edildy:allowWhenExpired';
/** A write that still works when the subscription has expired (sign-out, own preferences, push devices). */
export const AllowWhenExpired = () => SetMetadata(ALLOW_WHEN_EXPIRED_KEY, true);

export const CurrentPrincipal = createParamDecorator((_data: unknown, ctx: ExecutionContext): Principal => {
  const principal = ctx.switchToHttp().getRequest<AppRequest>().principal;
  if (!principal) throw new AppError('UNAUTHENTICATED');
  return principal;
});
