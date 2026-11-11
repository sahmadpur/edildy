import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FeatureKey } from '@edildy/contracts';
import { AppError } from '../common/app-error';
import { ALLOW_WHEN_EXPIRED_KEY, REQUIRED_FEATURE_KEY } from '../common/decorators';
import type { AppRequest } from '../common/request';

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * The plan's side of access control, after AuthGuard and PermissionGuard (BR-01.03, BR-01.06):
 * - a route marked RequireFeature answers FEATURE_NOT_IN_PLAN when the organisation's plan lacks that feature;
 * - once the subscription has expired (past the grace period), every write answers SUBSCRIPTION_EXPIRED unless
 *   marked AllowWhenExpired. Reads keep working, so the data stays visible.
 * Requests without a principal (public routes, Edildy staff on platform routes) are not affected.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const principal = req.principal;
    if (!principal) return true;
    const targets = [ctx.getHandler(), ctx.getClass()];
    const feature = this.reflector.getAllAndOverride<FeatureKey | undefined>(REQUIRED_FEATURE_KEY, targets);
    if (feature && !principal.subscription.features.includes(feature)) throw new AppError('FEATURE_NOT_IN_PLAN');
    if (principal.subscription.state === 'expired' && !READS.has(req.method) && !this.reflector.getAllAndOverride<boolean>(ALLOW_WHEN_EXPIRED_KEY, targets)) {
      throw new AppError('SUBSCRIPTION_EXPIRED');
    }
    return true;
  }
}
