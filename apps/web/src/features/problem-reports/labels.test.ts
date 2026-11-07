import { describe, expect, it } from 'vitest';
import { mapsLink, reportStateVariant } from './labels';

describe('problem report labels', () => {
  it('links a point to Google Maps', () => {
    expect(mapsLink(40.4093, 49.8671)).toBe('https://www.google.com/maps?q=40.4093,49.8671');
  });
  it('gives each state a badge variant', () => {
    expect(reportStateVariant('open')).toBe('warning');
    expect(reportStateVariant('task_assigned')).toBe('secondary');
    expect(reportStateVariant('resolved')).toBe('default');
    expect(reportStateVariant('closed')).toBe('outline');
  });
});
