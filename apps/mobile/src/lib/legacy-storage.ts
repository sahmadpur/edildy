/**
 * The app was called Taskop until November 2026, and the same install (bundle id az.taskop.app) updates in place.
 * Phones that ran a Taskop build keep their keychain entries and encrypted database under the old names; these
 * helpers carry them over so nobody is signed out and no unsynced offline work is lost. This file is the only place
 * the old names live.
 */

const LEGACY_PREFIX = 'taskop.';
const PREFIX = 'edildy.';

/** The pre-rename name of a keychain key (`edildy.me` → `taskop.me`), or null for a key that never had one. */
export function legacyKeyOf(key: string): string | null {
  return key.startsWith(PREFIX) ? LEGACY_PREFIX + key.slice(PREFIX.length) : null;
}

export interface KeyStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * Reads `key`. When it is empty but its pre-rename key holds a value, the value is moved to `key` first
 * (written, then the old entry removed), so later reads hit the new key directly.
 */
export async function readMigrating(store: KeyStore, key: string): Promise<string | null> {
  const value = await store.get(key);
  if (value !== null) return value;
  const legacy = legacyKeyOf(key);
  if (!legacy) return null;
  const old = await store.get(legacy);
  if (old === null) return null;
  await store.set(key, old);
  await store.remove(legacy);
  return old;
}

/** The encrypted database file Taskop builds created. */
export const LEGACY_DB_NAME = 'taskop.db';

/**
 * The database file to open: an existing pre-rename file keeps being used (moving a SQLite file and its WAL is not
 * worth the risk for a name nobody sees); a new install gets `name`.
 */
export function databaseNameToOpen(name: string, legacyFileExists: boolean): string {
  return legacyFileExists ? LEGACY_DB_NAME : name;
}
