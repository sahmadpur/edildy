import { type SQL, type SQLWrapper, sql } from 'drizzle-orm';

/**
 * Whether a user works at a site: linked to it, or to a site above it (feedback 2026-11-14). The staff of a branch
 * (Filial) work in all its zones and sections, so a check assigned to a zone can go to them without linking each
 * person to every zone. Both arguments may be columns, SQL fragments or ids.
 */
export function worksAt(userId: SQLWrapper | string, siteId: SQLWrapper | string): SQL {
  return sql`exists (
    select 1 from user_sites us
    join sites linked on linked.id = us.site_id
    join sites target on target.id = ${siteId}
    where us.user_id = ${userId} and target.path <@ linked.path)`;
}
