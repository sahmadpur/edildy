import type { ProblemReportDto } from '@taskop/contracts';

/** Test data for the problem report tests (2026-11-06 design). Not imported by application code. */
export const REPORT_AT = '2026-11-02T04:00:00.000Z';
export const REPORTER = { id: 'w1', fullName: 'Fərid Hacıyev' };

export const problemReportDto = (over: Partial<ProblemReportDto> = {}): ProblemReportDto => ({
  id: 'r1',
  siteId: 'site1',
  siteName: 'Anbar №1',
  severity: 'critical',
  text: 'Anbarın qapısı bağlanmır, kilid sınıb',
  location: { lat: 40.4093, lng: 49.8671, accuracyM: 12, capturedAt: REPORT_AT },
  reportedAt: REPORT_AT,
  createdAt: REPORT_AT,
  reporter: REPORTER,
  media: [{ id: 'm1', kind: 'photo', status: 'uploaded' }],
  state: 'open',
  taskId: null,
  taskStatus: null,
  closedAt: null,
  closedBy: null,
  closeComment: null,
  ...over,
});
