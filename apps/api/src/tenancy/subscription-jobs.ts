import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { addDays, daysLeft, localDateOf, SUBSCRIPTION_GRACE_DAYS, SUBSCRIPTION_WARNING_DAYS } from '@edildy/contracts';
import { pickLanguage } from '@edildy/i18n';
import { and, eq, isNotNull } from 'drizzle-orm';
import { Clock } from '../common/clock';
import { DbService } from '../db/db.service';
import { roles, tenants, users } from '../db/schema';
import { MAILER, type Mailer } from '../mail/mailer';
import { subscriptionMail } from '../mail/templates';
import { JobsService } from '../scheduling/jobs.service';

export const SUBSCRIPTION_EXPIRY_QUEUE = 'subscriptions.expiry';

/**
 * The warning due for `left` days to the end date: the nearest step not yet passed (14, 7, 1 days before), or `ended`
 * from the day after the end until the grace period is over; null otherwise.
 */
export function dueNotice(left: number): number | 'ended' | null {
  if (left < 0) return left >= -SUBSCRIPTION_GRACE_DAYS ? 'ended' : null;
  const steps = [...SUBSCRIPTION_WARNING_DAYS].sort((a, b) => a - b);
  return steps.find((w) => left <= w) ?? null;
}

/** subscriptions.expiry (BR-01.06/07): daily, e-mails the active owners before and when the subscription ends; each step once. */
@Injectable()
export class SubscriptionJobs implements OnModuleInit {
  private readonly logger = new Logger('SubscriptionJobs');

  constructor(
    private readonly db: DbService,
    private readonly clock: Clock,
    private readonly jobs: JobsService,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  onModuleInit(): void {
    // 05:00 UTC = 09:00 in Baku.
    this.jobs.define({ name: SUBSCRIPTION_EXPIRY_QUEUE, cron: '0 5 * * *', handler: (tenantIds) => this.notifyAll(tenantIds) });
  }

  async notifyAll(only?: string[]): Promise<number> {
    const now = this.clock.now();
    const rows = await this.db.platform
      .select({ id: tenants.id, name: tenants.name, timezone: tenants.timezone, locale: tenants.locale, endsOn: tenants.planEndsOn, notice: tenants.expiryNotice })
      .from(tenants)
      .where(and(isNotNull(tenants.planEndsOn), eq(tenants.status, 'active')));
    let sent = 0;
    for (const t of rows) {
      if (only && !only.includes(t.id)) continue;
      const left = daysLeft(t.endsOn, localDateOf(now, t.timezone))!;
      const step = dueNotice(left);
      const key = `${t.endsOn}:${step}`;
      if (step === null || t.notice === key) continue;
      try {
        const owners = await this.db.withTenant(t.id, null, (tx) =>
          tx
            .select({ email: users.email, fullName: users.fullName })
            .from(users)
            .innerJoin(roles, eq(roles.id, users.roleId))
            .where(and(eq(roles.systemKey, 'owner'), eq(users.status, 'active'))),
        );
        for (const o of owners) {
          if (!o.email) continue;
          await this.mailer.send(
            subscriptionMail({
              to: o.email,
              fullName: o.fullName,
              orgName: t.name,
              endsOn: t.endsOn!,
              graceEnd: addDays(t.endsOn!, SUBSCRIPTION_GRACE_DAYS),
              days: step === 'ended' ? -1 : left,
              locale: pickLanguage(t.locale),
            }),
          );
          sent++;
        }
        await this.db.platform.update(tenants).set({ expiryNotice: key }).where(eq(tenants.id, t.id));
      } catch (e) {
        this.logger.error({ err: e, tenantId: t.id }, 'Subscription notice failed');
      }
    }
    return sent;
  }
}
