import { addDays, type OccurrenceDto } from '@taskop/contracts';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { groupOccurrences } from '@/features/checklists/group-occurrences';
import { api, useSession } from '@/lib/session';
import { localDate } from '@/lib/time';
import { useOffline } from '@/offline/context';
import { useLiveQuery, useNow, useSyncStatus } from '@/offline/hooks';
import { type CalendarEntry, localEntries, mergeEntries, remoteEntry } from './calendar-model';

/** Every page of my runs in a range (at most 62 days, the API's list limit; a month view asks for 42). */
async function myRuns(from: string, to: string): Promise<OccurrenceDto[]> {
  const rows: OccurrenceDto[] = [];
  let cursor: string | undefined;
  do {
    const page = await api.occurrences.mine({ from, to, limit: 200, ...(cursor ? { cursor } : {}) });
    rows.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return rows;
}

export interface CalendarEntries {
  /** Null until the phone's own list has loaded. */
  entries: CalendarEntry[] | null;
  online: boolean;
  /** The server part of the range is still on its way. */
  fetching: boolean;
  /** The server could not be asked (offline or failed): only what the phone holds is shown. */
  localOnly: boolean;
}

/**
 * My runs in [from, to]: the phone's list (about a week back and the 14-day horizon ahead, live and offline) plus,
 * when online, the same range from GET /me/occurrences for what the phone no longer holds.
 */
export function useCalendarEntries(from: string, to: string): CalendarEntries {
  const services = useOffline();
  const session = useSession();
  const myName = session.status === 'authenticated' ? session.me.user.fullName : '';
  const now = useNow();
  const { online } = useSyncStatus();
  const list = useLiveQuery((x) => x.store.occurrences(), []);
  const today = localDate(now, services.timeZone);
  const remote = useQuery({
    queryKey: ['calendar', services.userId, from, to],
    queryFn: () => myRuns(addDays(from, -1), to),
    enabled: online,
    staleTime: 60_000,
  });
  const local = useMemo(() => (list ? localEntries(groupOccurrences(list, services.userId, now, today), services.timeZone) : null), [list, services.userId, services.timeZone, now, today]);
  const entries = useMemo(() => {
    if (!local) return null;
    const server = (remote.data ?? []).map((o) => remoteEntry(o, services.timeZone, now, myName));
    // The day before too: a night run that started then continues into the first column.
    const first = addDays(from, -1);
    return mergeEntries(local, server).filter((e) => e.localDate >= first && e.localDate <= to);
  }, [local, remote.data, services.timeZone, now, myName, from, to]);
  return { entries, online, fetching: online && remote.isFetching, localOnly: !online || remote.isError };
}
