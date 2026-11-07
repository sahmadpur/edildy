import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { idListParam, listParam, toListParam } from './common.js';

const A = '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e01';
const B = '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e02';

describe('list filters (multi-select)', () => {
  it('reads one value or a comma list, ignoring blanks and spaces', () => {
    expect(idListParam.parse(A)).toEqual([A]);
    expect(idListParam.parse(`${A}, ${B},`)).toEqual([A, B]);
    expect(listParam(z.enum(['minor', 'critical'])).parse('minor,critical')).toEqual(['minor', 'critical']);
  });

  it('refuses a bad value and an empty list', () => {
    expect(idListParam.safeParse(`${A},nope`).success).toBe(false);
    expect(idListParam.safeParse(',').success).toBe(false);
    expect(listParam(z.enum(['minor'])).safeParse('major').success).toBe(false);
  });

  it('writes nothing for "all" (no values) and joins the rest', () => {
    expect(toListParam([])).toBeUndefined();
    expect(toListParam(undefined)).toBeUndefined();
    expect(toListParam([A, B])).toBe(`${A},${B}`);
  });
});
