import { describe, expect, it } from 'vitest';
import {
  expandSchedule,
  fixedRuns,
  isOpenEnded,
  OPEN_ENDED_AT,
  slotStillOpen,
  type Recurrence,
  recurrenceSchema,
  scheduleDates,
  scheduleWarnings,
  isWholeDayWindow,
  slotFor,
  slotsFor,
  timingSchema,
  validateSchedule,
  validateTiming,
  windowMinutes,
} from './scheduling.js';
import { describeSchedule } from './scheduling-describe.js';

const ID = '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e5f';
const range = (startDate: string, extra: Partial<{ endDate: string | null; skipDates: string[] }> = {}) => ({
  startDate,
  endDate: null,
  skipDates: [],
  ...extra,
});

describe('recurrence schema', () => {
  it('accepts each kind', () => {
    const ok: Recurrence[] = [
      { kind: 'once', date: '2026-11-05' },
      { kind: 'daily', every: 1, ...range('2026-11-02') },
      { kind: 'weekly', every: 1, weekdays: [1, 3], ...range('2026-11-02') },
      { kind: 'monthly', every: 1, by: { dayOfMonth: 31 }, ...range('2026-11-02') },
      { kind: 'monthly', every: 1, by: { nth: -1, weekday: 5 }, ...range('2026-11-02') },
      { kind: 'dates', dates: ['2026-11-05'] },
    ];
    for (const r of ok) expect(recurrenceSchema.safeParse(r).success, r.kind).toBe(true);
  });

  it('rejects out-of-range values', () => {
    expect(recurrenceSchema.safeParse({ kind: 'daily', every: 0, ...range('2026-11-02') }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ kind: 'weekly', every: 1, weekdays: [], ...range('2026-11-02') }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ kind: 'weekly', every: 1, weekdays: [8], ...range('2026-11-02') }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ kind: 'monthly', every: 1, by: { nth: 5, weekday: 1 }, ...range('2026-11-02') }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ kind: 'dates', dates: [] }).success).toBe(false);
    expect(timingSchema.safeParse({ mode: 'fixed', startTime: '8:00', dueAfterMinutes: 60, graceMinutes: 0 }).success).toBe(false);
    expect(timingSchema.safeParse({ mode: 'fixed', startTime: '08:00', dueAfterMinutes: 0, graceMinutes: 0 }).success).toBe(false);
  });
});

describe('scheduleDates', () => {
  it('handles once and explicit dates', () => {
    expect(scheduleDates({ kind: 'once', date: '2026-11-05' }, '2026-11-01', '2026-11-30')).toEqual(['2026-11-05']);
    expect(scheduleDates({ kind: 'once', date: '2026-10-05' }, '2026-11-01', '2026-11-30')).toEqual([]);
    expect(scheduleDates({ kind: 'dates', dates: ['2026-11-09', '2026-11-03', '2026-12-01'] }, '2026-11-01', '2026-11-30')).toEqual(['2026-11-03', '2026-11-09']);
  });

  it('counts daily intervals from startDate', () => {
    expect(scheduleDates({ kind: 'daily', every: 3, ...range('2026-11-02') }, '2026-11-01', '2026-11-12')).toEqual(['2026-11-02', '2026-11-05', '2026-11-08', '2026-11-11']);
  });

  it('honours skip dates and the end date', () => {
    const r: Recurrence = { kind: 'daily', every: 1, ...range('2026-11-02', { endDate: '2026-11-05', skipDates: ['2026-11-03'] }) };
    expect(scheduleDates(r, '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-04', '2026-11-05']);
  });

  it('runs weekly on chosen weekdays every N weeks from the start week', () => {
    // 2026-11-04 is a Wednesday; its ISO week starts on Monday 2026-11-02.
    const r: Recurrence = { kind: 'weekly', every: 2, weekdays: [1, 5], ...range('2026-11-04') };
    expect(scheduleDates(r, '2026-11-01', '2026-11-30')).toEqual(['2026-11-06', '2026-11-16', '2026-11-20', '2026-11-30']);
  });

  it('clamps a monthly day of month to short months', () => {
    const r: Recurrence = { kind: 'monthly', every: 1, by: { dayOfMonth: 31 }, ...range('2026-01-01') };
    expect(scheduleDates(r, '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('runs monthly every N months from the start month', () => {
    const r: Recurrence = { kind: 'monthly', every: 2, by: { dayOfMonth: 15 }, ...range('2026-01-10') };
    expect(scheduleDates(r, '2026-01-01', '2026-06-30')).toEqual(['2026-01-15', '2026-03-15', '2026-05-15']);
  });

  it('finds the nth and the last weekday of a month', () => {
    const second: Recurrence = { kind: 'monthly', every: 1, by: { nth: 2, weekday: 2 }, ...range('2026-11-01') };
    expect(scheduleDates(second, '2026-11-01', '2026-12-31')).toEqual(['2026-11-10', '2026-12-08']);
    const last: Recurrence = { kind: 'monthly', every: 1, by: { nth: -1, weekday: 5 }, ...range('2026-11-01') };
    expect(scheduleDates(last, '2026-11-01', '2026-12-31')).toEqual(['2026-11-27', '2026-12-25']);
  });
});

describe('slots', () => {
  it('builds fixed slots in the tenant timezone', () => {
    const s = slotFor('2026-11-02', { mode: 'fixed', startTime: '08:00', dueAfterMinutes: 120, graceMinutes: 60 }, null, 'Asia/Baku');
    expect([s.startsAt, s.dueAt, s.closesAt].map((x) => x.toISOString())).toEqual([
      '2026-11-02T04:00:00.000Z',
      '2026-11-02T06:00:00.000Z',
      '2026-11-02T07:00:00.000Z',
    ]);
  });

  it('lets a shift cross midnight', () => {
    const s = slotFor('2026-11-02', { mode: 'shift', shiftId: ID, graceMinutes: 30 }, { ranges: [{ startTime: '22:00', endTime: '06:00' }] }, 'Asia/Baku');
    expect(s.localDate).toBe('2026-11-02');
    expect(s.startsAt.toISOString()).toBe('2026-11-02T18:00:00.000Z');
    expect(s.dueAt.toISOString()).toBe('2026-11-03T02:00:00.000Z');
    expect(s.closesAt.toISOString()).toBe('2026-11-03T02:30:00.000Z');
  });

  it('makes one run per shift period (feedback 2026-11-11, item 12)', () => {
    const timing = { mode: 'shift', shiftId: ID, graceMinutes: 15 } as const;
    const shift = { ranges: [{ startTime: '18:00', endTime: '20:00' }, { startTime: '08:00', endTime: '10:00' }] };
    const slots = slotsFor('2026-11-02', timing, shift, 'Asia/Baku');
    expect(slots.map((s) => [s.startsAt.toISOString(), s.dueAt.toISOString(), s.closesAt.toISOString()])).toEqual([
      ['2026-11-02T04:00:00.000Z', '2026-11-02T06:00:00.000Z', '2026-11-02T06:15:00.000Z'],
      ['2026-11-02T14:00:00.000Z', '2026-11-02T16:00:00.000Z', '2026-11-02T16:15:00.000Z'],
    ]);
    expect(slotFor('2026-11-02', timing, shift, 'Asia/Baku').startsAt.toISOString()).toBe('2026-11-02T04:00:00.000Z');
    expect(windowMinutes(timing, shift)).toBe(135);
    const days = expandSchedule({ kind: 'daily', every: 1, ...range('2026-11-02') }, timing, shift, 'Asia/Baku', '2026-11-02', '2026-11-03');
    expect(days.map((s) => s.localDate)).toEqual(['2026-11-02', '2026-11-02', '2026-11-03', '2026-11-03']);
  });

  it('keeps the wall-clock start across a DST change', () => {
    const timing = { mode: 'fixed', startTime: '08:00', dueAfterMinutes: 60, graceMinutes: 0 } as const;
    const slots = expandSchedule({ kind: 'daily', every: 1, ...range('2026-10-24') }, timing, null, 'Europe/Berlin', '2026-10-24', '2026-10-26');
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual(['2026-10-24T06:00:00.000Z', '2026-10-25T07:00:00.000Z', '2026-10-26T07:00:00.000Z']);
  });

  it('gives an "anytime" slot the whole local day, due at the next midnight with no grace', () => {
    const s = slotFor('2026-11-02', { mode: 'anytime' }, null, 'Asia/Baku');
    expect(s.localDate).toBe('2026-11-02');
    expect([s.startsAt, s.dueAt, s.closesAt].map((x) => x.toISOString())).toEqual([
      '2026-11-01T20:00:00.000Z',
      '2026-11-02T20:00:00.000Z',
      '2026-11-02T20:00:00.000Z',
    ]);
    expect(timingSchema.parse({ mode: 'anytime' })).toEqual({ mode: 'anytime' });
  });

  it('tells a whole-day window from a timed one', () => {
    const day = slotFor('2026-11-02', { mode: 'anytime' }, null, 'Asia/Baku');
    expect(isWholeDayWindow(day.startsAt, day.dueAt, 'Asia/Baku')).toBe(true);
    expect(isWholeDayWindow(day.startsAt.toISOString(), day.dueAt.toISOString(), 'Asia/Baku')).toBe(true);
    const timed = slotFor('2026-11-02', { mode: 'fixed', startTime: '08:00', dueAfterMinutes: 120, graceMinutes: 0 }, null, 'Asia/Baku');
    expect(isWholeDayWindow(timed.startsAt, timed.dueAt, 'Asia/Baku')).toBe(false);
  });

  it('measures windows', () => {
    expect(windowMinutes({ mode: 'fixed', startTime: '08:00', dueAfterMinutes: 120, graceMinutes: 60 }, null)).toBe(180);
    expect(windowMinutes({ mode: 'shift', shiftId: ID, graceMinutes: 30 }, { ranges: [{ startTime: '22:00', endTime: '06:00' }] })).toBe(510);
    expect(windowMinutes({ mode: 'anytime' }, null)).toBe(1440);
  });
});

describe('validateSchedule and warnings', () => {
  it('reports cross-field issues with paths relative to the schedule', () => {
    expect(validateSchedule({ kind: 'daily', every: 1, ...range('2026-11-10', { endDate: '2026-11-01' }) })).toEqual([
      { path: ['endDate'], code: 'scheduling.issues.endBeforeStart' },
    ]);
    expect(validateSchedule({ kind: 'weekly', every: 1, weekdays: [1, 1], ...range('2026-11-02') })).toEqual([
      { path: ['weekdays'], code: 'scheduling.issues.duplicateWeekday' },
    ]);
    expect(validateSchedule({ kind: 'dates', dates: ['2026-11-05', '2026-11-06', '2026-11-05'] })).toEqual([
      { path: ['dates', 2], code: 'scheduling.issues.duplicateDate' },
    ]);
    expect(validateSchedule({ kind: 'once', date: '2026-11-05' })).toEqual([]);
  });

  it('warns about skip dates outside the range', () => {
    expect(scheduleWarnings({ kind: 'daily', every: 1, ...range('2026-11-02', { skipDates: ['2026-10-01'] }) })).toEqual(['SKIP_DATE_OUT_OF_RANGE']);
    expect(scheduleWarnings({ kind: 'daily', every: 1, ...range('2026-11-02', { skipDates: ['2026-11-03'] }) })).toEqual([]);
  });
});

describe('several fixed times (feedback 2026-11-14)', () => {
  const fixed = { mode: 'fixed', startTime: '08:00', extraTimes: ['18:00', '13:00'], dueAfterMinutes: 120, graceMinutes: 60 } as const;

  it('parses with and without extra times', () => {
    expect(timingSchema.parse(fixed)).toEqual(fixed);
    expect(timingSchema.parse({ mode: 'fixed', startTime: '08:00', dueAfterMinutes: 120, graceMinutes: 60 })).not.toHaveProperty('extraTimes');
  });

  it('makes one run per time, in time order', () => {
    const slots = slotsFor('2026-11-02', fixed, null, 'UTC');
    expect(slots.map((s) => [s.startsAt.toISOString(), s.dueAt.toISOString(), s.closesAt.toISOString()])).toEqual([
      ['2026-11-02T08:00:00.000Z', '2026-11-02T10:00:00.000Z', '2026-11-02T11:00:00.000Z'],
      ['2026-11-02T13:00:00.000Z', '2026-11-02T15:00:00.000Z', '2026-11-02T16:00:00.000Z'],
      ['2026-11-02T18:00:00.000Z', '2026-11-02T20:00:00.000Z', '2026-11-02T21:00:00.000Z'],
    ]);
    expect(slotFor('2026-11-02', fixed, null, 'UTC').startsAt.toISOString()).toBe('2026-11-02T08:00:00.000Z');
  });

  it('rejects a repeated time and times closer than the time to complete', () => {
    expect(validateTiming(fixed)).toEqual([]);
    expect(validateTiming({ ...fixed, extraTimes: ['08:00'] })).toEqual([{ path: ['extraTimes', 0], code: 'scheduling.issues.duplicateTime' }]);
    expect(validateTiming({ ...fixed, extraTimes: ['09:00'] })).toEqual([{ path: ['dueAfterMinutes'], code: 'scheduling.issues.timesTooClose' }]);
  });
});

describe('each fixed time with its own icra müddəti (feedback 2026-11-27)', () => {
  // 18:00 lasts 30 minutes, 13:00 has no entry and falls back to the first time's 120.
  const fixed = { mode: 'fixed', startTime: '08:00', extraTimes: ['18:00', '13:00'], extraDueAfterMinutes: [30], dueAfterMinutes: 120, graceMinutes: 0 } as const;

  it('parses and gives every run its own length', () => {
    expect(timingSchema.parse(fixed)).toEqual(fixed);
    expect(fixedRuns(fixed)).toEqual([
      { time: '08:00', dueAfterMinutes: 120 },
      { time: '13:00', dueAfterMinutes: 120 },
      { time: '18:00', dueAfterMinutes: 30 },
    ]);
    const slots = slotsFor('2026-11-02', fixed, null, 'UTC');
    expect(slots.map((s) => s.dueAt.toISOString())).toEqual(['2026-11-02T10:00:00.000Z', '2026-11-02T15:00:00.000Z', '2026-11-02T18:30:00.000Z']);
  });

  it('uses the longest run for the window and checks each gap against the run before it', () => {
    expect(windowMinutes({ ...fixed, extraDueAfterMinutes: [300, 30] }, null)).toBe(300);
    expect(validateTiming(fixed)).toEqual([]);
    // 13:00 now lasts 6 hours, past 18:00.
    expect(validateTiming({ ...fixed, extraDueAfterMinutes: [30, 360] })).toEqual([{ path: ['dueAfterMinutes'], code: 'scheduling.issues.timesTooClose' }]);
  });

  it('describes each window', () => {
    const t = (k: string) => k;
    expect(describeSchedule({ kind: 'daily', every: 1, ...range('2026-11-01') }, fixed, null, t)).toBe(
      'scheduling.summary.daily, 08:00–10:00, 13:00–15:00, 18:00–18:30',
    );
  });
});

describe('repeat timing', () => {
  const repeat = { mode: 'repeat' as const, startTime: '08:00', endTime: '20:00', everyMinutes: 60 };
  it('makes a run every interval within the day, each open until the next starts', () => {
    const slots = slotsFor('2026-11-02', repeat, null, 'Asia/Baku');
    expect(slots).toHaveLength(12);
    expect(slots[0]).toEqual({
      localDate: '2026-11-02',
      startsAt: new Date('2026-11-02T04:00:00Z'),
      dueAt: new Date('2026-11-02T05:00:00Z'),
      closesAt: new Date('2026-11-02T05:00:00Z'),
    });
    expect(slots[11]!.startsAt).toEqual(new Date('2026-11-02T15:00:00Z'));
    expect(windowMinutes(repeat, null)).toBe(60);
  });
  it('cuts the last run at the end time', () => {
    const slots = slotsFor('2026-11-02', { ...repeat, endTime: '10:30', everyMinutes: 90 }, null, 'UTC');
    expect(slots.map((s) => [s.startsAt.toISOString(), s.dueAt.toISOString()])).toEqual([
      ['2026-11-02T08:00:00.000Z', '2026-11-02T09:30:00.000Z'],
      ['2026-11-02T09:30:00.000Z', '2026-11-02T10:30:00.000Z'],
    ]);
  });
  it('expands every scheduled day and keeps slotFor on the first run', () => {
    const r: Recurrence = { kind: 'daily', every: 1, ...range('2026-11-02') };
    expect(expandSchedule(r, repeat, null, 'UTC', '2026-11-02', '2026-11-03')).toHaveLength(24);
    expect(slotFor('2026-11-02', repeat, null, 'UTC').startsAt).toEqual(new Date('2026-11-02T08:00:00Z'));
  });
  it('validates the interval bounds and the end time', () => {
    expect(timingSchema.safeParse({ ...repeat, everyMinutes: 10 }).success).toBe(false);
    expect(validateTiming(repeat)).toEqual([]);
    expect(validateTiming({ ...repeat, endTime: '08:00' })).toEqual([{ path: ['endTime'], code: 'scheduling.issues.repeatEndBeforeStart' }]);
  });
});

describe('a fixed time with no Müddət (feedback 2026-11-27)', () => {
  // 08:00 has no deadline, 13:00 lasts 60 minutes, 18:00 has no deadline either.
  const fixed = {
    mode: 'fixed',
    startTime: '08:00',
    dueAfterMinutes: null,
    extraTimes: ['13:00', '18:00'],
    extraDueAfterMinutes: [60, null],
    graceMinutes: 30,
  } as const;

  it('parses null as no deadline and does not fall back to the first length', () => {
    expect(timingSchema.parse(fixed)).toEqual(fixed);
    expect(fixedRuns(fixed).map((r) => r.dueAfterMinutes)).toEqual([null, 60, null]);
    expect(
      fixedRuns({ ...fixed, dueAfterMinutes: 90, extraDueAfterMinutes: [null] }).map(
        (r) => r.dueAfterMinutes,
      ),
    ).toEqual([90, null, 90]);
  });

  it('makes an open-ended slot that is due and closes at the marker', () => {
    const [first, second] = slotsFor('2026-11-02', fixed, null, 'UTC');
    expect(first).toEqual({
      localDate: '2026-11-02',
      startsAt: new Date('2026-11-02T08:00:00Z'),
      dueAt: OPEN_ENDED_AT,
      closesAt: OPEN_ENDED_AT,
    });
    expect(isOpenEnded(first!.dueAt)).toBe(true);
    expect(isOpenEnded(second!.dueAt.toISOString())).toBe(false);
  });

  it('leaves open-ended runs out of the window and the gap check', () => {
    expect(windowMinutes(fixed, null)).toBe(90);
    expect(
      windowMinutes({ mode: 'fixed', startTime: '08:00', dueAfterMinutes: null, graceMinutes: 0 }, null),
    ).toBe(0);
    expect(validateTiming(fixed)).toEqual([]);
    expect(validateTiming({ ...fixed, extraDueAfterMinutes: [360, null] })).toEqual([
      { path: ['dueAfterMinutes'], code: 'scheduling.issues.timesTooClose' },
    ]);
  });

  it('keeps an open-ended slot only from today on', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    const slot = (localDate: string) => ({ localDate, dueAt: OPEN_ENDED_AT, closesAt: OPEN_ENDED_AT });
    expect(slotStillOpen(slot('2026-11-04'), now, '2026-11-05')).toBe(false);
    expect(slotStillOpen(slot('2026-11-05'), now, '2026-11-05')).toBe(true);
    const timed = {
      localDate: '2026-11-05',
      dueAt: new Date('2026-11-05T13:00:00Z'),
      closesAt: new Date('2026-11-05T13:00:00Z'),
    };
    expect(slotStillOpen(timed, now, '2026-11-05')).toBe(true);
    expect(slotStillOpen(timed, new Date('2026-11-05T13:00:00Z'), '2026-11-05')).toBe(false);
  });

  it('describes a run with no deadline', () => {
    const t = (k: string, v?: Record<string, string | number>) => (v?.time ? `${k}(${v.time})` : k);
    expect(describeSchedule({ kind: 'daily', every: 1, ...range('2026-11-01') }, fixed, null, t)).toBe(
      'scheduling.summary.daily, scheduling.summary.noDeadline(08:00), 13:00–14:00, scheduling.summary.noDeadline(18:00)',
    );
  });
});

describe('repeat with several windows (feedback 2026-11-27)', () => {
  const repeat = {
    mode: 'repeat' as const,
    startTime: '14:00',
    endTime: '16:00',
    everyMinutes: 30,
    extraWindows: [{ startTime: '08:00', endTime: '10:00', everyMinutes: 60 }],
  };

  it('makes runs in every window, in time order, each due within its own window', () => {
    const slots = slotsFor('2026-11-02', repeat, null, 'UTC');
    expect(
      slots.map((s) => [s.startsAt.toISOString().slice(11, 16), s.dueAt.toISOString().slice(11, 16)]),
    ).toEqual([
      ['08:00', '09:00'],
      ['09:00', '10:00'],
      ['14:00', '14:30'],
      ['14:30', '15:00'],
      ['15:00', '15:30'],
      ['15:30', '16:00'],
    ]);
    expect(windowMinutes(repeat, null)).toBe(60);
  });

  it('checks each window and rejects overlapping ones', () => {
    expect(validateTiming(repeat)).toEqual([]);
    expect(
      validateTiming({
        ...repeat,
        extraWindows: [{ startTime: '10:00', endTime: '09:00', everyMinutes: 60 }],
      }),
    ).toEqual([{ path: ['extraWindows', 0, 'endTime'], code: 'scheduling.issues.repeatEndBeforeStart' }]);
    expect(
      validateTiming({
        ...repeat,
        extraWindows: [{ startTime: '15:00', endTime: '17:00', everyMinutes: 60 }],
      }),
    ).toEqual([{ path: ['extraWindows', 0, 'startTime'], code: 'scheduling.issues.repeatWindowsOverlap' }]);
    // Touching windows are fine: 16:00 ends one and starts the next.
    expect(
      validateTiming({
        ...repeat,
        extraWindows: [{ startTime: '16:00', endTime: '17:00', everyMinutes: 60 }],
      }),
    ).toEqual([]);
    expect(
      timingSchema.safeParse({ ...repeat, extraWindows: Array(4).fill(repeat.extraWindows[0]) }).success,
    ).toBe(false);
  });

  it('describes every window', () => {
    const t = (k: string, v?: Record<string, string | number>) =>
      v?.range ? `${v.range} ${v.every}` : v?.n ? `${k}:${v.n}` : k;
    expect(describeSchedule({ kind: 'daily', every: 1, ...range('2026-11-01') }, repeat, null, t)).toBe(
      'scheduling.summary.daily, 08:00–10:00 scheduling.summary.everyHours:1, 14:00–16:00 scheduling.summary.everyMinutes:30',
    );
  });
});
