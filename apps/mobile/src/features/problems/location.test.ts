import { acquireLocation, type Fix, LAST_KNOWN_MAX_AGE_MS, LOCATION_TIMEOUT_MS, type LocationPort } from './location';

const fix: Fix = { lat: 40.4093, lng: 49.8671, accuracyM: 12, capturedAt: '2026-11-06T08:00:00.000Z' };

const port = (over: Partial<LocationPort> = {}): LocationPort => ({
  requestPermission: async () => 'granted',
  current: async () => null,
  lastKnown: async () => null,
  ...over,
});

/** 2026-11-06 design §7.5 (lenient): a fix when the phone can get one, the last known position as a fallback, else nothing. */
describe('acquireLocation', () => {
  it('reports a denied permission without asking the hardware', async () => {
    const current = jest.fn(async () => fix);
    expect(await acquireLocation(port({ requestPermission: async () => 'denied', current }))).toEqual({ status: 'denied' });
    expect(current).not.toHaveBeenCalled();
  });

  it('uses the current position when it arrives within the timeout', async () => {
    const current = jest.fn(async (timeoutMs: number) => (timeoutMs === LOCATION_TIMEOUT_MS ? fix : null));
    expect(await acquireLocation(port({ current }))).toEqual({ status: 'found', fix });
  });

  it('falls back to a recent last known position', async () => {
    const lastKnown = jest.fn(async (maxAgeMs: number) => (maxAgeMs === LAST_KNOWN_MAX_AGE_MS ? { ...fix, accuracyM: null } : null));
    expect(await acquireLocation(port({ lastKnown }))).toEqual({ status: 'found', fix: { ...fix, accuracyM: null } });
  });

  it('reports notFound when neither is available, also when the hardware throws', async () => {
    expect(await acquireLocation(port())).toEqual({ status: 'notFound' });
    expect(await acquireLocation(port({ current: async () => { throw new Error('gps off'); } }))).toEqual({ status: 'notFound' });
  });
});
