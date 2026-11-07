import { type SQL, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/** Escapes LIKE/ILIKE wildcards so user search text is matched literally. */
export const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** A parenthesised SQL list `($1, $2, …)` of bound values, for `in` and raw subqueries. Never empty: list filters have one value or more. */
export const sqlList = (values: readonly string[]): SQL => sql`(${sql.join(values.map((v) => sql`${v}`), sql`, `)})`;

/**
 * A site filter of one or more sites: the column's site lies in the subtree of any of them, so a parent site includes its
 * sub-sites (the reports rule, now every list's; feedback 2026-11-07). `sites` is tenant-scoped by RLS.
 */
export function inSiteSubtrees(siteCol: AnyPgColumn | SQL, siteIds: readonly string[]): SQL {
  return sql`exists (select 1 from sites fs, sites f where f.id in ${sqlList(siteIds)} and fs.id = ${siteCol} and fs.path <@ f.path)`;
}
