import * as Location from 'expo-location';

/** A GPS fix as a report carries it (2026-11-06 design §4). */
export interface Fix {
  lat: number;
  lng: number;
  accuracyM: number | null;
  capturedAt: string;
}

/** What the new-report screen needs from the phone's location hardware; `nativeLocation` is expo-location, tests use a fake. */
export interface LocationPort {
  requestPermission(): Promise<'granted' | 'denied'>;
  /** The current position, or null when none arrived within `timeoutMs`. */
  current(timeoutMs: number): Promise<Fix | null>;
  /** The last position the phone knows, if younger than `maxAgeMs`. */
  lastKnown(maxAgeMs: number): Promise<Fix | null>;
}

/** Design §7.5: the phone looks for a fix this long before the worker may send without one. */
export const LOCATION_TIMEOUT_MS = 15_000;
export const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;

export type LocationOutcome = { status: 'found'; fix: Fix } | { status: 'denied' } | { status: 'notFound' };

const toFix = (p: Location.LocationObject): Fix => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracyM: p.coords.accuracy ?? null,
  capturedAt: new Date(p.timestamp).toISOString(),
});

export const nativeLocation: LocationPort = {
  async requestPermission() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted' ? 'granted' : 'denied';
  },
  async current(timeoutMs) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    try {
      const p = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), expired]);
      return p ? toFix(p) : null;
    } finally {
      clearTimeout(timer);
    }
  },
  async lastKnown(maxAgeMs) {
    const p = await Location.getLastKnownPositionAsync({ maxAge: maxAgeMs });
    return p ? toFix(p) : null;
  },
};

/**
 * Lenient acquisition (owner's decision): permission first; then a current fix within the timeout; then a recent last
 * known position; else nothing. Hardware errors count as "not found", never as a crash of the form.
 */
export async function acquireLocation(port: LocationPort): Promise<LocationOutcome> {
  if ((await port.requestPermission()) === 'denied') return { status: 'denied' };
  try {
    const now = await port.current(LOCATION_TIMEOUT_MS);
    if (now) return { status: 'found', fix: now };
  } catch {
    // GPS off, airplane mode, a provider error: try the cache below.
  }
  try {
    const last = await port.lastKnown(LAST_KNOWN_MAX_AGE_MS);
    if (last) return { status: 'found', fix: last };
  } catch {
    // Same: nothing to use.
  }
  return { status: 'notFound' };
}
