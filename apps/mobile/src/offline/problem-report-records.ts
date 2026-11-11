import { PROBLEM_REPORT_LIMITS, type ProblemReportDto } from '@edildy/contracts';
import type { Db } from './db';
import { iso } from './local-model';

/**
 * Stores the server's copy of a problem report (from /me/sync or the create's answer). While the create is still queued
 * (other than `ignoreSeq`, the command whose answer this is) the phone's own copy wins: the server does not know it yet.
 */
export async function mergeReport(tx: Db, report: ProblemReportDto, now: number, ignoreSeq = -1): Promise<void> {
  const queued =
    (
      await tx.first<{ n: number }>(
        `SELECT count(*) AS n FROM outbox WHERE entity_type = 'problem_report' AND entity_id = ? AND kind = 'problem_report.create' AND seq <> ?`,
        [report.id, ignoreSeq],
      )
    )?.n ?? 0;
  if (queued > 0) return;
  await tx.run(
    `INSERT INTO problem_reports (id, data, local_status, sync_note, received_at, updated_at) VALUES (?, ?, 'sent', NULL, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, local_status = 'sent', sync_note = NULL, received_at = excluded.received_at, updated_at = excluded.updated_at`,
    [report.id, JSON.stringify(report), iso(now), iso(now)],
  );
}

/** Deletes a report with everything the phone holds for it. Returns the local files to delete once the transaction commits. */
export async function forgetReport(tx: Db, reportId: string): Promise<string[]> {
  const media = await tx.all<{ local_uri: string; file_deleted_at: string | null }>(`SELECT local_uri, file_deleted_at FROM media WHERE owner_type = 'problem_report' AND owner_id = ?`, [reportId]);
  await tx.run(`DELETE FROM outbox WHERE entity_type = 'problem_report' AND entity_id = ?`, [reportId]);
  await tx.run(`DELETE FROM media WHERE owner_type = 'problem_report' AND owner_id = ?`, [reportId]);
  await tx.run(`DELETE FROM media_refusals WHERE owner_type = 'problem_report' AND owner_id = ?`, [reportId]);
  await tx.run('DELETE FROM problem_reports WHERE id = ?', [reportId]);
  return media.filter((m) => m.file_deleted_at === null).map((m) => m.local_uri);
}

/**
 * Reports that left the sync set (older than 30 days and not open), unless a command of theirs is still queued or one of
 * their files is still uploading: those resolve first, and a later pull removes the report. Returns files to delete.
 */
export async function removeReports(tx: Db, ids: readonly string[]): Promise<string[]> {
  const files: string[] = [];
  for (const id of ids) {
    const busy = await tx.first<{ one: number }>(
      `SELECT 1 AS one WHERE EXISTS (SELECT 1 FROM outbox WHERE entity_type = 'problem_report' AND entity_id = ?)
          OR EXISTS (SELECT 1 FROM media WHERE owner_type = 'problem_report' AND owner_id = ?
                       AND registered_at IS NOT NULL AND uploaded_at IS NULL AND failed_code IS NULL)`,
      [id, id],
    );
    if (!busy) files.push(...(await forgetReport(tx, id)));
  }
  return files;
}

/** The ids of the 100 newest reports the phone holds, so /me/sync answers which of them left the set. */
export async function knownProblemReportIds(db: Db): Promise<string[]> {
  return (
    await db.all<{ id: string }>(`SELECT id FROM problem_reports ORDER BY json_extract(data, '$.createdAt') DESC, id LIMIT ?`, [PROBLEM_REPORT_LIMITS.knownIds])
  ).map((r) => r.id);
}

/** A report's medium the server refused for good (or the worker discarded): it leaves the local copy's media list; the note says why. */
export async function dropReportMedium(tx: Db, reportId: string, mediaId: string, now: number, errorKey: string | null): Promise<void> {
  const row = await tx.first<{ data: string }>('SELECT data FROM problem_reports WHERE id = ?', [reportId]);
  if (!row) return;
  const dto = JSON.parse(row.data) as ProblemReportDto;
  await tx.run('UPDATE problem_reports SET data = ?, updated_at = ? WHERE id = ?', [JSON.stringify({ ...dto, media: dto.media.filter((m) => m.id !== mediaId) }), iso(now), reportId]);
  if (errorKey) {
    await tx.run(`INSERT OR REPLACE INTO media_refusals (media_id, owner_type, owner_id, item_id, error_key, created_at) VALUES (?, 'problem_report', ?, NULL, ?, ?)`, [
      mediaId, reportId, errorKey, iso(now),
    ]);
  }
}
