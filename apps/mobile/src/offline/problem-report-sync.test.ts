import { ApiError } from '@taskop/api-client';
import { listCommands } from './outbox';
import { capturedPhoto } from './testing/fake-transport';
import { REPORT, SITE, syncReport, syncResponse, T, versionOf } from './testing/fixtures';
import { createHarness, type Harness } from './testing/harness';

const input = { siteId: SITE, siteName: 'Bakı filialı 1', reporterName: 'Aysel Əliyeva', severity: 'normal' as const, text: 'Anbarın qapısı bağlanmır', location: null };
const methods = (h: Harness) => h.api.calls.map((c) => c.method);
const refused = (code: 'SITE_NOT_ALLOWED') => new ApiError(403, code, `errors.${code}`);

/** 2026-11-06 design §7.4: the create goes first, then its media; refusals park the report with a reason; pulls bring the server's copies. */
describe('syncing problem reports', () => {
  it('sends the create, then the medium, applies the server’s copy, uploads the file and marks the report sent', async () => {
    const h = await createHarness();
    const id = await h.reports.create(input, [capturedPhoto(h.transport)]);
    await h.engine.run();
    expect(methods(h)).toEqual(['reportCreate', 'reportRegisterMedia', 'pull', 'reportRegisterMedia', 'reportConfirmUploaded']);
    expect(h.api.calls[0]!.body).toMatchObject({ id, siteId: SITE, text: input.text, reportedAt: T.open });
    const [view] = await h.reports.reports();
    expect(view).toMatchObject({ id, localStatus: 'sent', unsynced: false, failedKey: null });
    expect(view!.server.reporter.fullName).toBe('Aysel Əliyeva');
    const [medium] = await h.reports.media(id);
    expect(medium!.uploadedAt).not.toBeNull();
    expect(await listCommands(h.db)).toEqual([]);
  });

  it('a permanent refusal of the create parks the report with the reason and holds its medium; a retry sends both again', async () => {
    const h = await createHarness();
    const id = await h.reports.create(input, [capturedPhoto(h.transport)]);
    h.api.on('reportCreate', async () => {
      throw refused('SITE_NOT_ALLOWED');
    });
    await h.engine.run();
    expect(methods(h).filter((m) => m !== 'pull')).toEqual(['reportCreate']);
    const [view] = await h.reports.reports();
    expect(view).toMatchObject({ id, localStatus: 'draft', unsynced: true, failedKey: 'errors.SITE_NOT_ALLOWED', syncNote: 'errors.SITE_NOT_ALLOWED' });
    expect((await listCommands(h.db)).map((c) => [c.kind, c.status, c.title])).toEqual([
      ['problem_report.create', 'failed', input.text],
      ['problem_report.media', 'pending', input.text],
    ]);
    h.api.reset('reportCreate');
    await h.engine.retryFailed();
    expect((await h.reports.reports())[0]).toMatchObject({ localStatus: 'sent', unsynced: false, failedKey: null, syncNote: null });
  });

  it('a pull brings the server’s reports, removes listed ids, and refreshes the sites', async () => {
    const h = await createHarness();
    await h.seed(syncResponse({ checklistVersions: [versionOf(h.c.content)], problemReports: [syncReport({ state: 'closed', closedAt: T.open, closeComment: 'Yerində düzəldildi' })] }));
    expect((await h.reports.reports()).map((r) => [r.id, r.localStatus, r.server.state])).toEqual([[REPORT, 'sent', 'closed']]);
    await h.seed(syncResponse({ checklistVersions: [versionOf(h.c.content)], problemReports: [], removedProblemReportIds: [REPORT], reportSites: [{ id: SITE, name: 'Yeni ad' }] }));
    expect(await h.reports.reports()).toEqual([]);
    expect(await h.reports.sites()).toEqual([{ id: SITE, name: 'Yeni ad' }]);
  });

  it('a pull never overwrites a report whose create is still queued, and never removes one with queued work', async () => {
    const h = await createHarness();
    h.net.online = false;
    const id = await h.reports.create(input, []);
    await h.seed(syncResponse({ checklistVersions: [versionOf(h.c.content)], problemReports: [syncReport({ id, text: 'server copy', state: 'closed' })], removedProblemReportIds: [id] }));
    const [view] = await h.reports.reports();
    expect(view).toMatchObject({ id, localStatus: 'draft', unsynced: true });
    expect(view!.server.text).toBe(input.text);
  });
});
