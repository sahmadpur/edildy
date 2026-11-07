import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { peopleList } from './assignment-pages';

const t = i18n.getFixedT('az');

describe('peopleList (the "assignment created" message)', () => {
  it('names up to three people, then counts the rest', () => {
    expect(peopleList(['Aysel'], 'az', t)).toBe('Aysel');
    expect(peopleList(['Aysel', 'Kamran', 'Lalə'], 'az', t)).toBe('Aysel, Kamran və Lalə');
    expect(peopleList(['Aysel', 'Kamran', 'Lalə', 'Murad', 'Orxan'], 'az', t)).toBe('Aysel, Kamran, Lalə və daha 2 nəfər');
    expect(t('scheduling.assignments.createdFor', { names: 'Aysel və Kamran' })).toBe('Aysel və Kamran üçün təyinat yaradıldı');
  });
});
