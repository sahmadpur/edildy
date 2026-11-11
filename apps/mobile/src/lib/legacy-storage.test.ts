import { databaseNameToOpen, legacyKeyOf, readMigrating, type KeyStore } from './legacy-storage';

const memoryStore = (entries: Record<string, string>): KeyStore & { entries: Map<string, string> } => {
  const map = new Map(Object.entries(entries));
  return {
    entries: map,
    get: async (k) => map.get(k) ?? null,
    set: async (k, v) => void map.set(k, v),
    remove: async (k) => void map.delete(k),
  };
};

describe('legacy storage (Taskop → Edildy)', () => {
  it('maps edildy.* keys to their taskop.* names', () => {
    expect(legacyKeyOf('edildy.refreshToken')).toBe('taskop.refreshToken');
    expect(legacyKeyOf('other')).toBeNull();
  });

  it('moves a value stored under the old key to the new one', async () => {
    const store = memoryStore({ 'taskop.refreshToken': 'r1' });
    await expect(readMigrating(store, 'edildy.refreshToken')).resolves.toBe('r1');
    expect([...store.entries]).toEqual([['edildy.refreshToken', 'r1']]);
  });

  it('prefers the new key and leaves an old one alone', async () => {
    const store = memoryStore({ 'edildy.me': 'new', 'taskop.me': 'old' });
    await expect(readMigrating(store, 'edildy.me')).resolves.toBe('new');
    expect(store.entries.get('taskop.me')).toBe('old');
  });

  it('returns null when neither key is set', async () => {
    await expect(readMigrating(memoryStore({}), 'edildy.orgCode')).resolves.toBeNull();
  });

  it('keeps opening the Taskop database file on an upgraded install', () => {
    expect(databaseNameToOpen('edildy.db', true)).toBe('taskop.db');
    expect(databaseNameToOpen('edildy.db', false)).toBe('edildy.db');
  });
});
