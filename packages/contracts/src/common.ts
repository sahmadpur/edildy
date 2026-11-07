import { z } from 'zod';

export const idSchema = z.uuid();
export const isoDateTimeSchema = z.iso.datetime();

export const cursorQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const splitList = (s: string): string[] =>
  s
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * A list filter: `a,b` in the query string, matching any of the values (feedback 2026-11-07, the multi-select filters).
 * One value, as older clients send it, is a list of one.
 */
export const listParam = <T extends z.ZodType<unknown, string>>(item: T, max = 200) => z.string().transform(splitList).pipe(z.array(item).min(1).max(max));
/** `listParam` of ids. */
export const idListParam = listParam(idSchema);

/** The query value of a list filter: the values joined by commas, or undefined for "all" (an empty list). */
export const toListParam = (values: readonly string[] | undefined): string | undefined => (values && values.length ? values.join(',') : undefined);

export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.uuid().nullable() });

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
