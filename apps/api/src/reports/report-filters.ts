import { Injectable } from '@nestjs/common';
import { type ReportFilters, reportRangeTooLong } from '@edildy/contracts';
import { AppError } from '../common/app-error';
import { Clock } from '../common/clock';
import { DbService } from '../db/db.service';
import { tenants } from '../db/schema';

/** The shared filters (spec §5.2) with what every query needs from the tenant. */
export interface ResolvedFilters extends ReportFilters {
  timezone: string;
  tenantName: string;
  /** The instant "due" is measured against: one Clock reading per request (Spec decision 2). */
  now: Date;
}

@Injectable()
export class ReportFilterResolver {
  constructor(
    private readonly db: DbService,
    private readonly clock: Clock,
  ) {}

  async resolve(q: ReportFilters): Promise<ResolvedFilters> {
    if (reportRangeTooLong(q.from, q.to)) throw new AppError('REPORT_RANGE_TOO_LONG');
    const tx = this.db.tx();
    // RLS returns the current tenant's row only.
    const [tenant] = await tx.select({ timezone: tenants.timezone, name: tenants.name }).from(tenants);
    const f: ResolvedFilters = {
      from: q.from,
      to: q.to,
      siteId: q.siteId,
      userId: q.userId,
      checklistId: q.checklistId,
      timezone: tenant!.timezone,
      tenantName: tenant!.name,
      now: this.clock.now(),
    };
    return f;
  }
}
