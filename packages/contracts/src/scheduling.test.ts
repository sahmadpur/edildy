import { describe, expect, it } from 'vitest';
import {
  expandSchedule,
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
