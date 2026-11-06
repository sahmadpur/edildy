import { Injectable } from '@nestjs/common';
import type { ProblemReportDto } from '@taskop/contracts';
import { and, eq, ne } from 'drizzle-orm';
import { AppError } from '../common/app-error';
import { Clock } from '../common/clock';
import { DomainEvents } from '../common/domain-events';
import type { Principal } from '../common/request';
import { AuditService } from '../db/audit.service';
import { DbService } from '../db/db.service';
import { problemReports, tasks } from '../db/schema';
import { assertNotFuture } from '../tasks/task-time';
import type { CloseProblemReportDto, CreateProblemReportDto } from './dto';
import { ProblemReportQueries } from './problem-report-queries';
import { ProblemReportScope } from './problem-report-scope';

/** Create and close (2026-11-06 design §6.2). Each runs in the request's tenant transaction. */
@Injectable()
export class ProblemReportsService {
  constructor(
    private readonly db: DbService,
    private readonly clock: Clock,
    private readonly scope: ProblemReportScope,
    private readonly queries: ProblemReportQueries,
    private readonly audit: AuditService,
    private readonly events: DomainEvents,
  ) {}

  /** POST /problem-reports. Idempotent on the client id for the same reporter; another user reusing the id gets 409. */
  async create(p: Principal, dto: CreateProblemReportDto): Promise<ProblemReportDto> {
    const tx = this.db.tx();
    const now = this.clock.now();
    const [known] = await tx.select({ reporterUserId: problemReports.reporterUserId }).from(problemReports).where(eq(problemReports.id, dto.id));
    if (known) {
      if (known.reporterUserId !== p.userId) throw new AppError('REVISION_CONFLICT');
      return this.queries.detail(p, dto.id);
    }
    await this.scope.assertReportable(p, dto.siteId);
    const reportedAt = new Date(dto.reportedAt);
    assertNotFuture(reportedAt, now);
    const location = dto.location;
    await tx.insert(problemReports).values({
      id: dto.id,
      tenantId: p.tenantId,
      siteId: dto.siteId,
      reporterUserId: p.userId,
      severity: dto.severity,
      text: dto.text,
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      accuracyM: location?.accuracyM ?? null,
      locationAt: location ? new Date(location.capturedAt) : null,
      reportedAt,
      createdAt: now,
      updatedAt: now,
    });
    await this.audit.record({
      action: 'problem_report.created',
      entityType: 'problem_report',
      entityId: dto.id,
      after: { siteId: dto.siteId, severity: dto.severity, text: dto.text, hasLocation: location !== null },
    });
    await this.events.emit('problem_report.created', { tenantId: p.tenantId, reportId: dto.id, siteId: dto.siteId, severity: dto.severity, reporterUserId: p.userId, actorUserId: p.userId });
    return this.queries.detail(p, dto.id);
  }

  /** POST /problem-reports/:id/close: tasks.manage in scope; final; refused while a non-cancelled task exists. */
  async close(p: Principal, id: string, dto: CloseProblemReportDto): Promise<ProblemReportDto> {
    const tx = this.db.tx();
    const now = this.clock.now();
    const r = await this.scope.lock(id);
    const access = await this.scope.access(p, id);
    if (!access.canRead) throw new AppError('NOT_FOUND');
    if (!access.canManage) throw new AppError('FORBIDDEN');
    if (r.closedAt !== null) throw new AppError('PROBLEM_REPORT_CLOSED');
    const [active] = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.problemReportId, id), ne(tasks.status, 'cancelled')));
    if (active) throw new AppError('PROBLEM_REPORT_HAS_TASK');
    await tx.update(problemReports).set({ closedAt: now, closedByUserId: p.userId, closeComment: dto.comment, updatedAt: now }).where(eq(problemReports.id, id));
    await this.audit.record({ action: 'problem_report.closed', entityType: 'problem_report', entityId: id, after: { comment: dto.comment } });
    await this.events.emit('problem_report.closed', { tenantId: p.tenantId, reportId: id, reporterUserId: r.reporterUserId, actorUserId: p.userId });
    return this.queries.detail(p, id);
  }
}
