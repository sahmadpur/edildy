import { z } from 'zod';
import type { ContentIssue } from './checklist-content.js';
import { idSchema } from './common.js';
import {
  addDays,
  dayNumber,
  daysInMonth,
  fromDayNumber,
  isoWeekday,
  type LocalDate,
  localDateOf,
  localDateSchema,
  type LocalTime,
  localTimeSchema,
  timeToMinutes,
  zonedTimeToUtc,
} from './scheduling-time.js';

export const SCHEDULING_LIMITS = {
  /** FR-09.05: start → close without `assignments.extended_window`. */
  maxWindowMinutes: 24 * 60,
  /** Hard cap, even with `assignments.extended_window` (FR-09.06). */
  maxExtendedWindowMinutes: 7 * 24 * 60,
  horizonDays: 14,
  maxAssignees: 50,
  rosterMaxDays: 62,
  copyMaxWeeks: 12,
  previewSlots: 20,
  /** A schedule with no slot this many days ahead is rejected as empty. */
  emptyCheckDays: 366,
  maxListDays: 62,
} as const;

export const isoWeekdaySchema = z.number().int().min(1).max(7);

const range = {
  startDate: localDateSchema,
  endDate: localDateSchema.nullable(),
  skipDates: z.array(localDateSchema).max(366),
};

export const recurrenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('once'), date: localDateSchema }),
  z.object({ kind: z.literal('daily'), every: z.number().int().min(1).max(365), ...range }),
  z.object({ kind: z.literal('weekly'), every: z.number().int().min(1).max(52), weekdays: z.array(isoWeekdaySchema).min(1).max(7), ...range }),
  z.object({
    kind: z.literal('monthly'),
    every: z.number().int().min(1).max(12),
    by: z.union([
      z.object({ dayOfMonth: z.number().int().min(1).max(31) }),
      z.object({ nth: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]), weekday: isoWeekdaySchema }),
    ]),
    ...range,
  }),
  z.object({ kind: z.literal('dates'), dates: z.array(localDateSchema).min(1).max(366) }),
]);
export type Recurrence = z.infer<typeof recurrenceSchema>;
export type RecurrenceKind = Recurrence['kind'];
export const RECURRENCE_KINDS = ['once', 'daily', 'weekly', 'monthly', 'dates'] as const satisfies readonly RecurrenceKind[];

/** At most this many start times for one fixed-time assignment. */
export const FIXED_MAX_TIMES = 12;

export const REPEAT_LIMITS = { minEveryMinutes: 15, maxEveryMinutes: 720 } as const;
/** At most this many start–end windows for one "repeat" assignment (feedback 2026-11-27). */
export const REPEAT_MAX_WINDOWS = 4;

/**
 * A run's "Müddət" in minutes, or `null` for no deadline (feedback 2026-11-27): the run is never overdue or missed and
 * stays open until someone does it (see `OPEN_ENDED_AT`).
 */
const dueAfterMinutes = z.number().int().min(1).max(SCHEDULING_LIMITS.maxExtendedWindowMinutes).nullable();
const everyMinutes = z.number().int().min(REPEAT_LIMITS.minEveryMinutes).max(REPEAT_LIMITS.maxEveryMinutes);
const repeatWindowSchema = z.object({ startTime: localTimeSchema, endTime: localTimeSchema, everyMinutes });
const graceMinutes = z.number().int().min(0).max(SCHEDULING_LIMITS.maxExtendedWindowMinutes);
export const timingSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('fixed'),
    startTime: localTimeSchema,
    /**
     * "Sabit vaxt" with several times a day (feedback 2026-11-14): more start times besides `startTime`, e.g. 08:00,
     * 13:00 and 18:00. Each time is its own run with the same length; absent on assignments made before.
     */
    extraTimes: z.array(localTimeSchema).max(FIXED_MAX_TIMES - 1).optional(),
    dueAfterMinutes: dueAfterMinutes,
    /**
     * Each extra time's own "Müddət" (feedback 2026-11-27), index-aligned with `extraTimes`; a missing entry
     * (and every assignment made before) uses `dueAfterMinutes`, which stays the first time's length. `null` is an
     * explicit "no deadline" and does not fall back.
     */
    extraDueAfterMinutes: z.array(dueAfterMinutes).max(FIXED_MAX_TIMES - 1).optional(),
    graceMinutes,
  }),
  z.object({ mode: z.literal('shift'), shiftId: idSchema, graceMinutes }),
  /** "İstənilən vaxt" (feedback 2026-11-07): any time on the scheduled day, local midnight to midnight; no grace. */
  z.object({ mode: z.literal('anytime') }),
  /**
   * "Gün ərzində təkrar" (feedback 2026-11-08): runs every `everyMinutes` from `startTime` while the start is before
   * `endTime`, e.g. a toilet check every hour 08:00–20:00. Each run is open until the next one starts; no grace.
   * `extraWindows` (feedback 2026-11-27) adds more windows the same day, each with its own interval, e.g. 08:00–12:00
   * every hour and 14:00–18:00 every 30 minutes; absent on assignments made before.
   */
  z.object({
    mode: z.literal('repeat'),
    startTime: localTimeSchema,
    endTime: localTimeSchema,
    everyMinutes,
    extraWindows: z
      .array(repeatWindowSchema)
      .max(REPEAT_MAX_WINDOWS - 1)
      .optional(),
  }),
]);
export type TimingMode = Timing['mode'];
export const TIMING_MODES = ['fixed', 'shift', 'anytime', 'repeat'] as const satisfies readonly TimingMode[];
/** An "anytime" slot is the whole local day. */
export const ANYTIME_WINDOW_MINUTES = 1440;
export type Timing = z.infer<typeof timingSchema>;

/** One working period of a shift. An end at or before the start means the period ends the next day. */
export interface ShiftRange {
  startTime: LocalTime;
  endTime: LocalTime;
}

/**
 * A shift's working periods (feedback 2026-11-11, item 12): e.g. 08:00–10:00 and 18:00–20:00. Each period is its own
 * run of a shift-timed assignment: it opens at the period's start, is due at its end, and closes after the grace.
 */
export interface ShiftHours {
  ranges: readonly ShiftRange[];
}

export const SHIFT_MAX_RANGES = 4;

/** Length of one period in minutes (1–1440). */
export function rangeMinutes(r: ShiftRange): number {
  const d = timeToMinutes(r.endTime) - timeToMinutes(r.startTime);
  return d > 0 ? d : d + 1440;
}

/** Whether two periods share a minute on the 24-hour clock (a period that crosses midnight wraps round). */
export function rangesOverlap(a: ShiftRange, b: ShiftRange): boolean {
  const inside = (m: number, r: ShiftRange) => (m - timeToMinutes(r.startTime) + 1440) % 1440 < rangeMinutes(r);
  return inside(timeToMinutes(b.startTime), a) || inside(timeToMinutes(a.startTime), b);
}

/** "08:00–10:00, 18:00–20:00"; `nextDay` is appended to a period that ends the next day. */
export function formatShiftRanges(ranges: readonly ShiftRange[], nextDay: string): string {
  return ranges.map((r) => `${r.startTime}–${r.endTime}${r.endTime <= r.startTime ? ` (${nextDay})` : ''}`).join(', ');
}

export interface Slot {
  localDate: LocalDate;
  startsAt: Date;
  dueAt: Date;
  closesAt: Date;
}

/** The longest period of the shift: the window of its longest run. */
export function shiftDurationMinutes(s: ShiftHours): number {
  return Math.max(...s.ranges.map(rangeMinutes));
}

/**
 * A run with no "Müddət" (feedback 2026-11-27) is due and closes at this instant, so the sweep never makes it overdue
 * or missed and it stays open until someone does it. The columns stay NOT NULL, so installed phones keep reading dates.
 */
export const OPEN_ENDED_AT = new Date('2100-01-01T00:00:00.000Z');

/** Whether a run's due (or close) instant is the no-deadline marker. */
export function isOpenEnded(at: string | Date): boolean {
  return +new Date(at) >= +OPEN_ENDED_AT;
}

/**
 * Whether a slot can still be done: it has not closed. A slot with no deadline never closes, so only today's and later
 * ones count; runs are never made for days already gone.
 */
export function slotStillOpen(
  s: Pick<Slot, 'localDate' | 'dueAt' | 'closesAt'>,
  now: Date,
  today: LocalDate,
): boolean {
  return s.closesAt > now && (!isOpenEnded(s.dueAt) || s.localDate >= today);
}

/** One run of a fixed-time assignment: its start and its own length, `null` for no deadline. */
export interface FixedRun {
  time: LocalTime;
  dueAfterMinutes: number | null;
}

/** Every run of a fixed-time assignment, sorted by time; a repeated time keeps its first entry. */
export function fixedRuns(timing: Extract<Timing, { mode: 'fixed' }>): FixedRun[] {
  const runs: FixedRun[] = [{ time: timing.startTime, dueAfterMinutes: timing.dueAfterMinutes }];
  (timing.extraTimes ?? []).forEach((time, i) => {
    const own = timing.extraDueAfterMinutes?.[i];
    if (!runs.some((r) => r.time === time))
      runs.push({ time, dueAfterMinutes: own === undefined ? timing.dueAfterMinutes : own });
  });
  return runs.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}

/** Every start time of a fixed-time assignment, sorted, without repeats. */
export function fixedStartTimes(timing: Extract<Timing, { mode: 'fixed' }>): LocalTime[] {
  return fixedRuns(timing).map((r) => r.time);
}

/** Start → close length of every slot (FR-09.05); a run with no deadline has no length and is left out. */
export function windowMinutes(timing: Timing, shift: ShiftHours | null): number {
  if (timing.mode === 'fixed') {
    const lengths = fixedRuns(timing).flatMap((r) => (r.dueAfterMinutes === null ? [] : [r.dueAfterMinutes]));
    return lengths.length ? Math.max(...lengths) + timing.graceMinutes : 0;
  }
  if (timing.mode === 'anytime') return ANYTIME_WINDOW_MINUTES;
  if (timing.mode === 'repeat') return Math.max(...repeatWindows(timing).map((w) => w.everyMinutes));
  if (!shift) throw new Error('shift timing needs the shift hours');
  return shiftDurationMinutes(shift) + timing.graceMinutes;
}

type RangeRecurrence = Exclude<Recurrence, { kind: 'once' | 'dates' }>;

function matches(r: RangeRecurrence, d: LocalDate): boolean {
  const dn = dayNumber(d);
  const start = dayNumber(r.startDate);
  switch (r.kind) {
    case 'daily':
      return (dn - start) % r.every === 0;
    case 'weekly': {
      const weekStart = start - (isoWeekday(r.startDate) - 1);
      return r.weekdays.includes(isoWeekday(d)) && Math.floor((dn - weekStart) / 7) % r.every === 0;
    }
    case 'monthly': {
      const [y, m, day] = d.split('-').map(Number) as [number, number, number];
      const [sy, sm] = r.startDate.split('-').map(Number) as [number, number];
      if (((y - sy) * 12 + (m - sm)) % r.every !== 0) return false;
      const len = daysInMonth(y, m);
      if ('dayOfMonth' in r.by) return day === Math.min(r.by.dayOfMonth, len);
      if (isoWeekday(d) !== r.by.weekday) return false;
      return r.by.nth === -1 ? day + 7 > len : Math.ceil(day / 7) === r.by.nth;
    }
  }
}

/** Local dates the rule fires on within [from, to] (inclusive), in order. */
export function scheduleDates(r: Recurrence, from: LocalDate, to: LocalDate): LocalDate[] {
  if (r.kind === 'once' || r.kind === 'dates') {
    const list = r.kind === 'once' ? [r.date] : r.dates;
    return [...new Set(list)].filter((d) => d >= from && d <= to).sort();
  }
  const skip = new Set(r.skipDates);
  const first = Math.max(dayNumber(from), dayNumber(r.startDate));
  const last = Math.min(dayNumber(to), r.endDate ? dayNumber(r.endDate) : Number.POSITIVE_INFINITY);
  const out: LocalDate[] = [];
  for (let n = first; n <= last; n++) {
    const d = fromDayNumber(n);
    if (!skip.has(d) && matches(r, d)) out.push(d);
  }
  return out;
}

/** One start–end window of a "repeat" assignment and its interval. */
export interface RepeatWindow {
  startTime: LocalTime;
  endTime: LocalTime;
  everyMinutes: number;
}

/** Every window of a "repeat" assignment, sorted by start: the first one plus `extraWindows`. */
export function repeatWindows(timing: Extract<Timing, { mode: 'repeat' }>): RepeatWindow[] {
  const first = { startTime: timing.startTime, endTime: timing.endTime, everyMinutes: timing.everyMinutes };
  return [first, ...(timing.extraWindows ?? [])].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
  );
}

/** Each repeat run within the day, in minutes: startTime, +every, … while before endTime, in every window; due at the next start or the window's end. */
export function repeatRuns(timing: Extract<Timing, { mode: 'repeat' }>): { start: number; due: number }[] {
  return repeatWindows(timing).flatMap((w) => {
    const start = timeToMinutes(w.startTime);
    const end = timeToMinutes(w.endTime);
    const out: { start: number; due: number }[] = [];
    for (let m = start; m < end; m += w.everyMinutes)
      out.push({ start: m, due: Math.min(m + w.everyMinutes, end) });
    return out;
  });
}

/** Start minutes of each repeat run within the day. */
export function repeatStarts(timing: Extract<Timing, { mode: 'repeat' }>): number[] {
  return repeatRuns(timing).map((r) => r.start);
}

/** A shift period's slot on a day: start, due at the period's end (next day when it crosses midnight), then the grace. */
function rangeSlot(date: LocalDate, range: ShiftRange, graceMinutes: number, tz: string): Slot {
  const startsAt = zonedTimeToUtc(date, timeToMinutes(range.startTime), tz);
  const overnight = timeToMinutes(range.endTime) <= timeToMinutes(range.startTime);
  const dueAt = zonedTimeToUtc(overnight ? addDays(date, 1) : date, timeToMinutes(range.endTime), tz);
  return { localDate: date, startsAt, dueAt, closesAt: new Date(+dueAt + graceMinutes * 60_000) };
}

/** Every slot on one scheduled day: one for most timings, several for "repeat" and for a shift with several periods. */
export function slotsFor(date: LocalDate, timing: Timing, shift: ShiftHours | null, tz: string): Slot[] {
  if (timing.mode === 'shift') {
    if (!shift) throw new Error('shift timing needs the shift hours');
    return shift.ranges.map((range) => rangeSlot(date, range, timing.graceMinutes, tz)).sort((a, b) => +a.startsAt - +b.startsAt);
  }
  if (timing.mode === 'fixed') {
    return fixedRuns(timing).map((run) => fixedSlot(date, run, timing, tz));
  }
  if (timing.mode !== 'repeat') return [slotFor(date, timing, shift, tz)];
  return repeatRuns(timing).map((r) => {
    const startsAt = zonedTimeToUtc(date, r.start, tz);
    const dueAt = zonedTimeToUtc(date, r.due, tz);
    return { localDate: date, startsAt, dueAt, closesAt: dueAt };
  });
}

function fixedSlot(date: LocalDate, run: FixedRun, timing: Extract<Timing, { mode: 'fixed' }>, tz: string): Slot {
  const startsAt = zonedTimeToUtc(date, timeToMinutes(run.time), tz);
  if (run.dueAfterMinutes === null)
    return { localDate: date, startsAt, dueAt: OPEN_ENDED_AT, closesAt: OPEN_ENDED_AT };
  const dueAt = new Date(+startsAt + run.dueAfterMinutes * 60_000);
  return { localDate: date, startsAt, dueAt, closesAt: new Date(+dueAt + timing.graceMinutes * 60_000) };
}

/** One slot for a day; "repeat", several fixed times and a shift with several periods give their first run (use `slotsFor` for all). */
export function slotFor(date: LocalDate, timing: Timing, shift: ShiftHours | null, tz: string): Slot {
  if (timing.mode === 'repeat' || timing.mode === 'shift') {
    const first = slotsFor(date, timing, shift, tz)[0];
    if (!first) throw new Error(`${timing.mode} timing has no run`);
    return first;
  }
  if (timing.mode === 'fixed') return fixedSlot(date, fixedRuns(timing)[0]!, timing, tz);
  if (timing.mode === 'anytime') {
    // Midnight to the next midnight in the tenant's zone: due when the day ends, nothing after.
    const startsAt = zonedTimeToUtc(date, 0, tz);
    const dueAt = zonedTimeToUtc(addDays(date, 1), 0, tz);
    return { localDate: date, startsAt, dueAt, closesAt: dueAt };
  }
  return timing satisfies never;
}

/**
 * Whether a run's window is one whole local day, midnight to midnight: an "İstənilən vaxt" run (or a fixed one set up
 * the same way). Screens then say "any time" instead of "00:00–00:00".
 */
export function isWholeDayWindow(startsAt: string | Date, dueAt: string | Date, tz: string): boolean {
  const start = new Date(startsAt);
  const date = localDateOf(start, tz);
  return +start === +zonedTimeToUtc(date, 0, tz) && +new Date(dueAt) === +zonedTimeToUtc(addDays(date, 1), 0, tz);
}

export function expandSchedule(r: Recurrence, timing: Timing, shift: ShiftHours | null, tz: string, from: LocalDate, to: LocalDate): Slot[] {
  return scheduleDates(r, from, to).flatMap((d) => slotsFor(d, timing, shift, tz));
}

export const SCHEDULING_ISSUE_CODES = [
  'scheduling.issues.endBeforeStart',
  'scheduling.issues.duplicateDate',
  'scheduling.issues.duplicateWeekday',
  'scheduling.issues.shiftZeroLength',
  'scheduling.issues.shiftRangesOverlap',
  'scheduling.issues.rangeTooLong',
  'scheduling.issues.dateOutOfRange',
  'scheduling.issues.repeatEndBeforeStart',
  'scheduling.issues.duplicateTime',
  'scheduling.issues.timesTooClose',
  'scheduling.issues.repeatWindowsOverlap',
] as const;
export type SchedulingIssueCode = (typeof SCHEDULING_ISSUE_CODES)[number];

/** Cross-field checks the Zod schema cannot express. Paths are relative to the schedule. */
export function validateSchedule(r: Recurrence): ContentIssue[] {
  const issues: ContentIssue[] = [];
  if (r.kind === 'once') return issues;
  if (r.kind === 'dates') {
    const seen = new Set<string>();
    r.dates.forEach((d, i) => {
      if (seen.has(d)) issues.push({ path: ['dates', i], code: 'scheduling.issues.duplicateDate' });
      seen.add(d);
    });
    return issues;
  }
  if (r.endDate && r.endDate < r.startDate) issues.push({ path: ['endDate'], code: 'scheduling.issues.endBeforeStart' });
  if (r.kind === 'weekly' && new Set(r.weekdays).size !== r.weekdays.length) {
    issues.push({ path: ['weekdays'], code: 'scheduling.issues.duplicateWeekday' });
  }
  return issues;
}

/** Cross-field timing checks. Paths are relative to the timing. */
export function validateTiming(timing: Timing): ContentIssue[] {
  if (timing.mode === 'fixed') {
    const issues: ContentIssue[] = [];
    const extra = timing.extraTimes ?? [];
    const seen = new Set([timing.startTime]);
    extra.forEach((time, i) => {
      if (seen.has(time)) issues.push({ path: ['extraTimes', i], code: 'scheduling.issues.duplicateTime' });
      seen.add(time);
    });
    // Each run is due before the next one starts, so two runs of one assignment never overlap their working time.
    // A run with no deadline stays open on its own and does not hold the next one back.
    const runs = fixedRuns(timing);
    const tooClose = (r: FixedRun, i: number) => {
      const prev = runs[i - 1];
      return (
        prev !== undefined &&
        prev.dueAfterMinutes !== null &&
        timeToMinutes(r.time) - timeToMinutes(prev.time) < prev.dueAfterMinutes
      );
    };
    if (runs.some(tooClose))
      issues.push({ path: ['dueAfterMinutes'], code: 'scheduling.issues.timesTooClose' });
    return issues;
  }
  if (timing.mode !== 'repeat') return [];
  const issues: ContentIssue[] = [];
  const windows = [timing, ...(timing.extraWindows ?? [])];
  const at = (i: number): (string | number)[] => (i === 0 ? [] : ['extraWindows', i - 1]);
  windows.forEach((w, i) => {
    if (timeToMinutes(w.endTime) <= timeToMinutes(w.startTime))
      issues.push({ path: [...at(i), 'endTime'], code: 'scheduling.issues.repeatEndBeforeStart' });
  });
  // Two windows of one day may not share a minute: their runs would overlap.
  windows.forEach((w, i) => {
    const overlaps = windows
      .slice(0, i)
      .some(
        (o) =>
          timeToMinutes(w.startTime) < timeToMinutes(o.endTime) &&
          timeToMinutes(o.startTime) < timeToMinutes(w.endTime),
      );
    if (i > 0 && overlaps)
      issues.push({ path: [...at(i), 'startTime'], code: 'scheduling.issues.repeatWindowsOverlap' });
  });
  return issues;
}

export const PREVIEW_WARNINGS = ['NO_ROSTERED_ASSIGNEES', 'SKIP_DATE_OUT_OF_RANGE'] as const;
export type PreviewWarning = (typeof PREVIEW_WARNINGS)[number];

/** Warnings that depend only on the rule; the API adds the roster-based one. */
export function scheduleWarnings(r: Recurrence): PreviewWarning[] {
  if (r.kind === 'once' || r.kind === 'dates') return [];
  const outside = r.skipDates.some((d) => d < r.startDate || (r.endDate !== null && d > r.endDate));
  return outside ? ['SKIP_DATE_OUT_OF_RANGE'] : [];
}

/** `superRefine` for `{ from, to }` queries: 1 ≤ days ≤ maxDays, reported on `to`. */
export const localRangeCheck =
  (maxDays: number) =>
  (v: { from: LocalDate; to: LocalDate }, ctx: z.RefinementCtx): void => {
    const days = dayNumber(v.to) - dayNumber(v.from) + 1;
    if (days < 1 || days > maxDays) ctx.addIssue({ code: 'custom', path: ['to'], message: 'scheduling.issues.rangeTooLong' });
  };
