import { describe, expect, it } from 'vitest';
import { shortName } from './format';

describe('shortName', () => {
  it('keeps the first name and the surname initial', () => {
    expect(shortName('Aynur Quliyeva')).toBe('Aynur Q.');
    expect(shortName('  Elvin   İsmayıl  Məmmədov ')).toBe('Elvin M.');
    expect(shortName('Kamran əliyev')).toBe('Kamran Ə.');
    // Azerbaijani capitals: i → İ.
    expect(shortName('Rəşad isayev')).toBe('Rəşad İ.');
  });

  it('leaves a one-word name as it is', () => {
    expect(shortName('Admin')).toBe('Admin');
    expect(shortName('')).toBe('');
  });
});
