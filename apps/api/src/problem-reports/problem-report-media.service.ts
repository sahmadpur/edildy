import { Injectable } from '@nestjs/common';
import { MEDIA_LIMITS, type MediaConfirmResult, type MediaUploadTicket, type MediaUrl, PROBLEM_REPORT_LIMITS } from '@taskop/contracts';
import { and, count, eq } from 'drizzle-orm';
import { AppError } from '../common/app-error';
import { Clock } from '../common/clock';
import type { Principal } from '../common/request';
import { DbService } from '../db/db.service';
import { problemReportMedia, problemReports } from '../db/schema';
import { assertStored, signView, tooLarge } from '../executions/media.service';
import { S3Service } from '../storage/s3.service';
import { assertNotFuture } from '../tasks/task-time';
import type { ProblemReportMediaRegisterDto } from './dto';
import { ProblemReportScope } from './problem-report-scope';

export type ProblemReportMediaRow = typeof problemReportMedia.$inferSelect;

/** A report's photos and videos (2026-11-06 design §6.2): the task media flow without roles. */
@Injectable()
export class ProblemReportMediaService {
  constructor(
    private readonly db: DbService,
    private readonly clock: Clock,
    private readonly s3: S3Service,
    private readonly scope: ProblemReportScope,
  ) {}

  /** POST /problem-reports/:id/media: the reporter only, while the report is open; same id → a fresh URL, none once uploaded. */
  async register(p: Principal, reportId: string, cmd: ProblemReportMediaRegisterDto): Promise<MediaUploadTicket> {
    const tx = this.db.tx();
    const receivedAt = this.clock.now();
    const r = await this.scope.lock(reportId);
    if (r.reporterUserId !== p.userId) throw new AppError('NOT_FOUND');
    const [known] = await tx.select().from(problemReportMedia).where(eq(problemReportMedia.id, cmd.id));
    if (known) {
      if (known.reportId !== reportId) throw new AppError('NOT_FOUND');
      if (known.status === 'uploaded') return { mediaId: known.id, status: 'uploaded', uploadUrl: null, headers: {}, expiresAt: null };
      return this.ticket(known);
    }
    if (r.closedAt !== null) throw new AppError('PROBLEM_REPORT_CLOSED');
    assertNotFuture(new Date(cmd.capturedAt), receivedAt);
    if (!(MEDIA_LIMITS.mimeTypes[cmd.kind] as readonly string[]).includes(cmd.mime)) throw new AppError('MEDIA_TYPE_INVALID');
    if (tooLarge(cmd)) throw new AppError('MEDIA_TOO_LARGE');
    const [n] = await tx.select({ n: count() }).from(problemReportMedia).where(eq(problemReportMedia.reportId, reportId));
    if ((n?.n ?? 0) >= PROBLEM_REPORT_LIMITS.maxMedia) throw new AppError('MEDIA_LIMIT_REACHED');
    const ext = MEDIA_LIMITS.extensions[cmd.mime as keyof typeof MEDIA_LIMITS.extensions];
    const [row] = await tx
      .insert(problemReportMedia)
      .values({
        id: cmd.id,
        tenantId: p.tenantId,
        reportId,
        kind: cmd.kind,
        source: cmd.source,
        mime: cmd.mime,
        bytes: cmd.bytes,
        width: cmd.width ?? null,
        height: cmd.height ?? null,
        durationMs: cmd.durationMs ?? null,
        capturedAt: new Date(cmd.capturedAt),
        capturedByUserId: p.userId,
        storageKey: `t/${p.tenantId}/pr/${reportId}/${cmd.id}.${ext}`,
        createdAt: receivedAt,
      })
      .returning();
    return this.ticket(row!);
  }

  /** POST /problem-report-media/:id/uploaded: the reporter; the object must exist with the registered size and type. */
  async confirmUploaded(p: Principal, mediaId: string): Promise<MediaConfirmResult> {
    const tx = this.db.tx();
    const [m] = await tx.select().from(problemReportMedia).where(eq(problemReportMedia.id, mediaId)).for('update');
    if (!m || m.capturedByUserId !== p.userId) throw new AppError('NOT_FOUND');
    if (m.status === 'uploaded') return { mediaId, status: 'uploaded', uploadedAt: m.uploadedAt?.toISOString() ?? null };
    await assertStored(this.s3, m);
    const now = this.clock.now();
    await tx.update(problemReportMedia).set({ status: 'uploaded', uploadedAt: now, storagePurgedAt: null }).where(eq(problemReportMedia.id, mediaId));
    return { mediaId, status: 'uploaded', uploadedAt: now.toISOString() };
  }

  /** GET /problem-report-media/:id/url: a 5-minute presigned GET for anyone who can read the report. */
  async viewUrl(p: Principal, mediaId: string): Promise<MediaUrl> {
    const [m] = await this.db
      .tx()
      .select({ storageKey: problemReportMedia.storageKey, status: problemReportMedia.status })
      .from(problemReportMedia)
      .innerJoin(problemReports, eq(problemReports.id, problemReportMedia.reportId))
      .where(and(eq(problemReportMedia.id, mediaId), this.scope.readable(p)));
    if (!m) throw new AppError('NOT_FOUND');
    if (m.status !== 'uploaded') throw new AppError('MEDIA_NOT_FOUND_IN_STORAGE');
    return signView(this.s3, m.storageKey);
  }

  private async ticket(m: ProblemReportMediaRow): Promise<MediaUploadTicket> {
    const put = await this.s3.presignPut(m.storageKey, m.mime, m.bytes);
    return { mediaId: m.id, status: m.status, uploadUrl: put.url, headers: put.headers, expiresAt: put.expiresAt.toISOString() };
  }
}
