import { createDb, migrate, MIGRATIONS } from './db';
import { OCC, T, TASK, VERSION } from './testing/fixtures';
import { nodeDriver } from './testing/node-db';

/** 2026-11-06 design §7.4: commands and media may belong to a problem report; two new tables. */
describe('local database version 5', () => {
  it('rebuilds outbox, media and media_refusals to accept problem_report owners, keeping rows and the outbox numbering', async () => {
    const db = createDb(nodeDriver());
    await migrate(db, MIGRATIONS.slice(0, 4));
    await db.run(
      `INSERT INTO executions (id, occurrence_id, checklist_version_id, state, claim, started_at, answers, rev, updated_at)
       VALUES ('e', ?, ?, 'active', 'accepted', ?, '{}', 1, ?)`,
      [OCC, VERSION, T.open, T.open],
    );
    await db.run(`INSERT INTO outbox (entity_type, entity_id, kind, payload, created_at) VALUES ('execution', 'e', 'claim', '{}', ?)`, [T.open]);
    await db.run(`INSERT INTO outbox (entity_type, entity_id, kind, payload, created_at) VALUES ('task', ?, 'task.accept', '{}', ?)`, [TASK, T.open]);
    await db.run(`DELETE FROM outbox WHERE seq = 1`);
    await db.run(
      `INSERT INTO media (id, owner_type, owner_id, kind, source, mime, bytes, captured_at, local_uri) VALUES ('m', 'execution', 'e', 'photo', 'camera', 'image/jpeg', 10, ?, 'file:///m.jpg')`,
      [T.open],
    );
    await db.run(`INSERT INTO media_refusals (media_id, owner_type, owner_id, error_key, created_at) VALUES ('m2', 'task', ?, 'errors.X', ?)`, [TASK, T.open]);
    expect(await migrate(db)).toBe(5);
    expect(MIGRATIONS).toHaveLength(5);
    expect(await db.all('SELECT seq, entity_type, entity_id, kind FROM outbox ORDER BY seq')).toEqual([{ seq: 2, entity_type: 'task', entity_id: TASK, kind: 'task.accept' }]);
    // The numbering continues after the highest seq ever used, as before the rebuild.
    await db.run(`INSERT INTO outbox (entity_type, entity_id, kind, payload, created_at) VALUES ('problem_report', 'r', 'problem_report.create', '{}', ?)`, [T.open]);
    expect(await db.first('SELECT max(seq) AS seq FROM outbox')).toEqual({ seq: 3 });
    expect(await db.all('SELECT id, owner_type, owner_id FROM media')).toEqual([{ id: 'm', owner_type: 'execution', owner_id: 'e' }]);
    expect(await db.all('SELECT media_id, owner_type FROM media_refusals')).toEqual([{ media_id: 'm2', owner_type: 'task' }]);
    await db.run(
      `INSERT INTO media (id, owner_type, owner_id, kind, source, mime, bytes, captured_at, local_uri) VALUES ('m3', 'problem_report', 'r', 'photo', 'camera', 'image/jpeg', 10, ?, 'file:///m3.jpg')`,
      [T.open],
    );
    await expect(db.run(`INSERT INTO outbox (entity_type, entity_id, kind, payload, created_at) VALUES ('other', 'r', 'x', '{}', ?)`, [T.open])).rejects.toThrow();
    await db.run(`INSERT INTO problem_reports (id, data, local_status, updated_at) VALUES ('r', '{}', 'draft', ?)`, [T.open]);
    await expect(db.run(`INSERT INTO problem_reports (id, data, local_status, updated_at) VALUES ('r2', '{}', 'weird', ?)`, [T.open])).rejects.toThrow();
    await db.run(`INSERT INTO report_sites (id, name) VALUES ('s', 'Filial 1')`);
    expect(await db.first('SELECT count(*) AS n FROM report_sites')).toEqual({ n: 1 });
  });
});
