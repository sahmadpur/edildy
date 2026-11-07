import { PROBLEM_REPORT_LIMITS, type ProblemReportDto, type ProblemReportLocation, type ProblemReportMediaRegisterInput, type ProblemSeverity, type ReportSite } from '@taskop/contracts';
import { type CapturedMedia, MediaLimitError, type StoreDeps } from './execution-store';
import { iso, type LocalMedia, type LocalProblemReport, type MediaRow, type ProblemReportRow, toMedia, toProblemReport } from './local-model';
import { appendCommand } from './outbox';

export interface ProblemReportView extends LocalProblemReport {
  /** Commands of the report are still on the phone (waiting or failed). */
  unsynced: boolean;
  /** The i18n key of a command of the report the server refused and that waits for "Yenidən cəhd et" or "Sil". */
  failedKey: string | null;
}

export interface NewProblemReport {
  siteId: string;
  siteName: string;
  severity: ProblemSeverity;
  text: string;
  location: ProblemReportLocation | null;
  /** The signed-in user's name, for the local copy shown until the server's arrives. */
  reporterName: string;
}

/** The registration body of a report medium (POST /problem-reports/:id/media) with the device's capture time. */
export function problemReportMediaBody(m: Pick<LocalMedia, 'id' | 'kind' | 'source' | 'mime' | 'bytes' | 'width' | 'height' | 'durationMs' | 'capturedAt'>): ProblemReportMediaRegisterInput {
  return { id: m.id, kind: m.kind, source: m.source, mime: m.mime, bytes: m.bytes, width: m.width, height: m.height, durationMs: m.durationMs, capturedAt: m.capturedAt };
}

/**
 * The worker's problem reports (2026-11-06 design §7.4). A report is written with its media rows and its commands in one
 * transaction, works offline, and syncs at once; the phone never edits or deletes a report afterwards.
 */
export function createProblemReportStore(deps: Pick<StoreDeps, 'db' | 'clock' | 'newId' | 'feed' | 'onWrite'> & { userId: string }) {
  const { db, clock, newId, feed, onWrite, userId } = deps;

  async function create(input: NewProblemReport, media: readonly CapturedMedia[]): Promise<string> {
    if (media.length > PROBLEM_REPORT_LIMITS.maxMedia) throw new MediaLimitError();
    const text = input.text.trim();
    if (text.length === 0 || text.length > PROBLEM_REPORT_LIMITS.textMax) throw new RangeError(`A report holds 1 to ${PROBLEM_REPORT_LIMITS.textMax} characters`);
    const now = clock.now();
    const reportedAt = iso(now);
    const id = newId();
    const mediaIds = media.map(() => newId());
    const dto: ProblemReportDto = {
      id,
      siteId: input.siteId,
      siteName: input.siteName,
      severity: input.severity,
      text,
      location: input.location,
      reportedAt,
      createdAt: reportedAt,
      reporter: { id: userId, fullName: input.reporterName },
      media: media.map((m, i) => ({ id: mediaIds[i]!, kind: m.kind, status: 'pending' as const })),
      state: 'open',
      taskId: null,
      taskStatus: null,
      closedAt: null,
      closedBy: null,
      closeComment: null,
    };
    await db.transaction(async (tx) => {
      await tx.run(`INSERT INTO problem_reports (id, data, local_status, sync_note, received_at, updated_at) VALUES (?, ?, 'draft', NULL, NULL, ?)`, [id, JSON.stringify(dto), reportedAt]);
      await appendCommand(tx, {
        entityType: 'problem_report', entityId: id, kind: 'problem_report.create',
        payload: { id, siteId: input.siteId, severity: input.severity, text, location: input.location, reportedAt }, createdAt: reportedAt,
      });
      for (const [i, m] of media.entries()) {
        const mediaId = mediaIds[i]!;
        await tx.run(
          `INSERT INTO media (id, owner_type, owner_id, item_id, role, kind, source, mime, bytes, width, height, duration_ms, captured_at, local_uri)
           VALUES (?, 'problem_report', ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [mediaId, id, m.kind, m.source, m.mime, m.bytes, m.width, m.height, m.durationMs, m.capturedAt, m.localUri],
        );
        await appendCommand(tx, { entityType: 'problem_report', entityId: id, kind: 'problem_report.media', refId: mediaId, payload: { ...problemReportMediaBody({ ...m, id: mediaId }) }, createdAt: reportedAt });
      }
    });
    feed.emit();
    // A report should reach the manager at once, like a checklist claim.
    onWrite('claim');
    return id;
  }

  async function views(rows: ProblemReportRow[]): Promise<ProblemReportView[]> {
    const queued = await db.all<{ entity_id: string; failed_key: string | null }>(
      `SELECT entity_id, max(CASE WHEN status = 'failed' THEN coalesce(error_key, 'errors.INTERNAL') END) AS failed_key
       FROM outbox WHERE entity_type = 'problem_report' GROUP BY entity_id`,
    );
    const byReport = new Map(queued.map((q) => [q.entity_id, q.failed_key]));
    return rows.map((r) => {
      const report = toProblemReport(r);
      return { ...report, unsynced: byReport.has(report.id), failedKey: byReport.get(report.id) ?? null };
    });
  }

  return {
    create,
    /** Newest first, by the device time of the send. */
    reports: async (): Promise<ProblemReportView[]> =>
      views(await db.all<ProblemReportRow>(`SELECT * FROM problem_reports ORDER BY json_extract(data, '$.reportedAt') DESC, id DESC`)),
    async report(id: string): Promise<ProblemReportView | null> {
      return (await views(await db.all<ProblemReportRow>('SELECT * FROM problem_reports WHERE id = ?', [id])))[0] ?? null;
    },
    /** The media the phone holds for the report, in capture order. */
    async media(reportId: string): Promise<LocalMedia[]> {
      const rows = await db.all<MediaRow>(`SELECT * FROM media WHERE owner_type = 'problem_report' AND owner_id = ? ORDER BY captured_at, id`, [reportId]);
      return rows.map(toMedia);
    },
    /** The sites the last pull said the user may report at, in the server's order. */
    sites: (): Promise<ReportSite[]> => db.all<ReportSite>('SELECT id, name FROM report_sites ORDER BY rowid'),
  };
}

export type ProblemReportStore = ReturnType<typeof createProblemReportStore>;
