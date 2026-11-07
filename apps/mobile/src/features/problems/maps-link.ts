import { Platform } from 'react-native';

/** The platform's maps app at a point (2026-11-06 design §7.5): Apple Maps on iOS, a geo: intent on Android. */
export function mapsUrl(lat: number, lng: number): string {
  const point = `${lat},${lng}`;
  return Platform.OS === 'android' ? `geo:${point}?q=${point}` : `https://maps.apple.com/?ll=${point}&q=${point}`;
}
