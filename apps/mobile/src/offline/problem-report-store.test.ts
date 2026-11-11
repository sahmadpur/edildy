import { MEDIA_LIMITS, PROBLEM_REPORT_LIMITS } from '@edildy/contracts';
import { MediaLimitError } from './execution-store';
import { capturedPhoto, capturedVideo } from './testing/fake-transport';
import { ME, SITE, syncResponse, T, versionOf } from './testing/fixtures';
import { createHarness, type Harness } from './testing/harness';

const commands = (h: Harness) =>
  h.db.all<{ kind: string; entity_id: string; ref_id: string | null; payload: string }>(`SELECT kind, entity_id, ref_id, payload FROM outbox WHERE entity_type = 'problem_report' ORDER BY seq`);

const input = { siteId: SITE, siteName: 'Bakı filialı 1', reporterName: 'Aysel Əliyeva', severity: 'critical' as const, text: 'Anbarın qapısı bağlanmır', location: { lat: 40.4093, lng: 49.8671, accuracyM: 12, capturedAt: T.open } };

/** 2026-11-06 design §7.4: a report is written with its media and its commands in one transaction and syncs at once. */
describe('problem report store', () => {
  it('create writes the row, the media and the commands atomically, newest first in views, unsynced until acked', async () => {
    const h = await createHarness();
    const photo = capturedPhoto(h.transport);
    const video = capturedVideo(h.transport, { capturedAt: '2026-11-02T04:12:00.000Z' });
    const id = await h.reports.create(input, [photo, video]);
    const queued = await commands(h);
    expect(queued.map((c) => [c.kind, c.entity_id, c.ref_id !== null])).toEqual([['problem_report.create', id, false], ['problem_report.media', id, true], ['problem_report.media', id, true]]);
    expect(JSON.parse(queued[0]!.payload)).toEqual({ id, siteId: SITE, severity: 'critical', text: input.text, location: input.location, reportedAt: T.open });
    expect(JSON.parse(queued[1]!.payload)).toMatchObject({ kind: 'photo', source: 'camera', mime: 'image/jpeg', bytes: 250_000, capturedAt: T.open });
    expect(JSON.parse(queued[1]!.payload)).not.toHaveProperty('role');
    const media = await h.reports.media(id);
    expect(media.map((m) => [m.ownerType, m.ownerId, m.kind, m.registeredAt])).toEqual([['problem_report', id, 'photo', null], ['problem_report', id, 'video', null]]);
    const [view] = await h.reports.reports();
    expect(view).toMatchObject({ id, localStatus: 'draft', unsynced: true, failedKey: null, syncNote: null });
    expect(view!.server).toMatchObject({
      id, siteId: SITE, siteName: 'Bakı filialı 1', severity: 'critical', text: input.text, location: input.location, reportedAt: T.open, createdAt: T.open,
      reporter: { id: ME, fullName: 'Aysel Əliyeva' }, state: 'open', taskId: null, closedAt: null, media: [{ id: media[0]!.id, kind: 'photo', status: 'pending' }, { id: media[1]!.id, kind: 'video', status: 'pending' }],
    });
    expect(h.writes).toEqual(['claim']);
    // A second report lists first.
    h.clock.advance(60_000);
    const second = await h.reports.create({ ...input, text: 'İkinci', location: null }, []);
    expect((await h.reports.reports()).map((r) => r.id)).toEqual([second, id]);
    expect((await h.reports.report(second))!.server.location).toBeNull();
  });

  it('refuses more than the media limit and text over the limit, writing nothing', async () => {
    const h = await createHarness();
    const six = Array.from({ length: MEDIA_LIMITS.problemMaxMedia + 1 }, () => capturedPhoto(h.transport));
    await expect(h.reports.create(input, six)).rejects.toBeInstanceOf(MediaLimitError);
    await expect(h.reports.create({ ...input, text: 'x'.repeat(PROBLEM_REPORT_LIMITS.textMax + 1) }, [])).rejects.toBeInstanceOf(RangeError);
    expect(await commands(h)).toEqual([]);
    expect(await h.db.first('SELECT count(*) AS n FROM problem_reports')).toEqual({ n: 0 });
  });

  it('sites() reads the sites the last pull brought', async () => {
    const h = await createHarness();
    await h.seed(syncResponse({ checklistVersions: [versionOf(h.c.content)], reportSites: [{ id: SITE, name: 'Bakı filialı 1' }, { id: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e41', name: 'Anbar' }] }));
    expect((await h.reports.sites()).map((s) => s.name)).toEqual(['Bakı filialı 1', 'Anbar']);
  });
});
