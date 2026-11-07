import { Platform } from 'react-native';
import { mapsUrl } from './maps-link';

describe('mapsUrl', () => {
  it('opens Apple Maps on iOS and a geo: intent on Android, both at the point', () => {
    Platform.OS = 'ios';
    expect(mapsUrl(40.4093, 49.8671)).toBe('https://maps.apple.com/?ll=40.4093,49.8671&q=40.4093,49.8671');
    Platform.OS = 'android';
    expect(mapsUrl(40.4093, 49.8671)).toBe('geo:40.4093,49.8671?q=40.4093,49.8671');
    Platform.OS = 'ios';
  });
});
