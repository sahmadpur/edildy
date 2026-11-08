import { addDays, isWholeDayWindow, type OccurrenceDto, zonedTimeToUtc } from '@taskop/contracts';
import { cardDot } from '@/features/checklists/occurrence-card';
import { GROUP_KEYS, type Groups } from '@/features/checklists/group-occurrences';
import { colors } from '@/lib/theme';

/** The three Outlook-like views of the Cədvəl tab (feedback 2026-11-08). */
export const CALENDAR_VIEWS = ['day', 'threeDays', 'month'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

/** Where tapping an entry goes: the run itself (start, continue, preview, view), a run's archive page, or nowhere. */
export type EntryTarget = { kind: 'run'; occurrenceId: string } | { kind: 'archive'; executionId: string } | null;

/** One of my runs on the calendar. */
export interface CalendarEntry {
  id: string;
  name: string;
  site: string;
  localDate: string;
  startsAt: string;
  dueAt: string;
  closesAt: string;
  /** The status shown on the agenda row, as an i18n key (`executions.states.*` or `scheduling.statuses.*`); null when open. */
  statusKey: string | null;
  /** Who did a run only the server holds, when it was not me (it opens only for its executor). */
  doneBy: string | null;
  /** The same dot colour as the run's Home card. */
  color: string;
  /** An "İstənilən vaxt" run: the whole local day, shown in the all-day strip instead of the hour grid. */
  allDay: boolean;
  target: EntryTarget;
}

/** 1 = Monday … 7 = Sunday (the `mobile.calendar.weekdays.w*` keys). */
export const weekdayOf = (date: string): number => ((new Date(`${date}T00:00:00.000Z`).getUTCDay() + 6) % 7) + 1;

/** `YYYY-MM-DD` of the Monday on or before `date`. */
export function weekStart(date: string): string {
  return addDays(date, 1 - weekdayOf(date));
}

/** The days a Day or 3-day view shows from its anchor. */
export function columnDays(view: Exclude<CalendarView, 'month'>, anchor: string): string[] {
  return view === 'day' ? [anchor] : [anchor, addDays(anchor, 1), addDays(anchor, 2)];
}

/** The month of `date` as whole Monday-first weeks (4–6 rows of 7 days); days of the next/previous month fill the edges. */
export function monthWeeks(date: string): string[][] {
  const first = `${date.slice(0, 8)}01`;
  const [y, m] = first.split('-').map(Number) as [number, number];
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const start = weekStart(first);
  const lead = Math.round((Date.parse(`${first}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
  const rows = Math.ceil((lead + days) / 7);
  return Array.from({ length: rows }, (_, r) => Array.from({ length: 7 }, (_, c) => addDays(start, r * 7 + c)));
}

/** The first and last day a view shows: what to ask the API for. */
export function viewRange(view: CalendarView, anchor: string): { from: string; to: string } {
  if (view === 'month') {
    const weeks = monthWeeks(anchor);
    return { from: weeks[0]![0]!, to: weeks[weeks.length - 1]![6]! };
  }
  const days = columnDays(view, anchor);
  return { from: days[0]!, to: days[days.length - 1]! };
}

/** The anchor one step back (-1) or forward (+1): a day, three days, or a month (to its 1st, or today inside it). */
export function stepAnchor(view: CalendarView, anchor: string, dir: -1 | 1, today: string): string {
  if (view === 'day') return addDays(anchor, dir);
  if (view === 'threeDays') return addDays(anchor, 3 * dir);
  const [y, m] = anchor.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + dir, 1));
  const first = d.toISOString().slice(0, 10);
  return today.slice(0, 7) === first.slice(0, 7) ? today : first;
}

export const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);

/** A run's part inside one day column, in minutes from local midnight; a night run continues on the next column. */
export interface Segment {
  entry: CalendarEntry;
  top: number;
  bottom: number;
  /** Side-by-side placement among the runs it overlaps. */
  col: number;
  cols: number;
}

/** The shortest block drawn, so a run with a short window still has room for its name. */
export const MIN_BLOCK_MINUTES = 30;
const DAY_MINUTES = 24 * 60;

/** The timed runs of `day` as blocks laid out side by side where they overlap (Outlook's clash layout). */
export function daySegments(entries: readonly CalendarEntry[], day: string, timeZone: string): Segment[] {
  const dayStart = +zonedTimeToUtc(day, 0, timeZone);
  const dayEnd = +zonedTimeToUtc(addDays(day, 1), 0, timeZone);
  const raw: Segment[] = [];
  for (const entry of entries) {
    if (entry.allDay) continue;
    const start = Date.parse(entry.startsAt);
    const end = Math.max(Date.parse(entry.closesAt), start);
    if (start >= dayEnd || (end <= dayStart && !(start === end && start >= dayStart))) continue;
    const top = Math.max(0, (start - dayStart) / 60_000);
    const bottom = Math.min(DAY_MINUTES, Math.max((Math.min(end, dayEnd) - dayStart) / 60_000, top + MIN_BLOCK_MINUTES));
    raw.push({ entry, top, bottom, col: 0, cols: 1 });
  }
  raw.sort((a, b) => a.top - b.top || b.bottom - a.bottom || a.entry.name.localeCompare(b.entry.name));
  // Clusters of runs that overlap one another share the width; each takes the first free column.
  let cluster: Segment[] = [];
  let clusterEnd = -1;
  const close = () => {
    const cols = Math.max(1, ...cluster.map((s) => s.col + 1));
    for (const s of cluster) s.cols = cols;
    cluster = [];
  };
  for (const s of raw) {
    if (s.top >= clusterEnd) {
      close();
      clusterEnd = -1;
    }
    const taken = new Set(cluster.filter((o) => o.bottom > s.top).map((o) => o.col));
    let col = 0;
    while (taken.has(col)) col += 1;
    s.col = col;
    cluster.push(s);
    clusterEnd = Math.max(clusterEnd, s.bottom);
  }
  close();
  return raw;
}

/** The entries listed for one day (the month agenda and the all-day strip): by start time. */
export function entriesOn(entries: readonly CalendarEntry[], day: string): CalendarEntry[] {
  return entries.filter((e) => e.localDate === day).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.name.localeCompare(b.name));
}

/** My runs on the phone, from the same groups as Home, so the colour and what a tap does match the Home card. */
export function localEntries(groups: Groups, timeZone: string): CalendarEntry[] {
  const out: CalendarEntry[] = [];
  for (const key of GROUP_KEYS) {
    for (const card of groups[key]) {
      const o = card.occurrence;
      const e = o.execution;
      out.push({
        id: o.id,
        name: o.checklistName,
        site: o.siteName,
        localDate: o.localDate,
        startsAt: o.startsAt,
        dueAt: o.dueAt,
        closesAt: o.closesAt,
        statusKey: e && e.state !== 'active' ? `executions.states.${e.state}` : !e && o.status !== 'pending' ? `scheduling.statuses.${o.status}` : card.overdue ? 'mobile.checklists.overdue' : null,
        doneBy: null,
        color: cardDot(card, key),
        allDay: isWholeDayWindow(o.startsAt, o.dueAt, timeZone),
        target: card.action === 'none' ? null : { kind: 'run', occurrenceId: o.id },
      });
    }
  }
  return out;
}

const DONE: ReadonlySet<string> = new Set(['completed', 'partial', 'audit_pending', 'audited', 'correction_required']);

/** The dot of a run only the server holds (older than the phone keeps): by its status. */
function remoteColor(o: OccurrenceDto, now: number): string {
  if (DONE.has(o.status)) return colors.success;
  if (o.status === 'missed' || o.status === 'overdue') return colors.danger;
  if (o.status === 'cancelled') return colors.planned;
  return now < Date.parse(o.startsAt) ? colors.planned : colors.primary;
}

/**
 * A run from GET /me/occurrences. It opens on its archive page when I did it; a run assigned to me that a colleague
 * did is only listed with their name — GET /executions/:id answers 404 to a worker who is not its executor.
 */
export function remoteEntry(o: OccurrenceDto, timeZone: string, now: number, myName: string): CalendarEntry {
  const brief = o.executionBrief;
  const mine = brief !== null && brief.executorName === myName;
  return {
    id: o.id,
    name: o.checklistName,
    site: o.siteName,
    localDate: o.localDate,
    startsAt: o.startsAt,
    dueAt: o.dueAt,
    closesAt: o.closesAt,
    statusKey: brief && brief.state !== 'active' ? `executions.states.${brief.state}` : !brief && o.status !== 'pending' ? `scheduling.statuses.${o.status}` : null,
    doneBy: brief && !mine ? brief.executorName : null,
    color: remoteColor(o, now),
    allDay: isWholeDayWindow(o.startsAt, o.dueAt, timeZone),
    target: brief && mine ? { kind: 'archive', executionId: brief.executionId } : null,
  };
}

/** The phone's own copy wins over the server's: it carries unsynced work and the exact Home state. */
export function mergeEntries(local: readonly CalendarEntry[], remote: readonly CalendarEntry[]): CalendarEntry[] {
  const ids = new Set(local.map((e) => e.id));
  return [...local, ...remote.filter((e) => !ids.has(e.id))];
}
