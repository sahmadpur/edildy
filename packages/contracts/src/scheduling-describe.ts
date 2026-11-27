import { type FixedRun, fixedRuns, type Recurrence, repeatWindows, type Timing } from './scheduling.js';
import { minutesToTime, timeToMinutes } from './scheduling-time.js';

/** The caller's translate function, so contracts stays free of UI strings. */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

const weekdayList = (days: number[], t: Translate): string =>
  [...new Set(days)]
    .sort((a, b) => a - b)
    .map((d) => t(`scheduling.weekdaysShort.${d}`))
    .join(', ');

function describeDays(r: Recurrence, t: Translate): string {
  switch (r.kind) {
    case 'once':
      return t('scheduling.summary.once', { date: r.date });
    case 'dates':
      return t('scheduling.summary.dates', { count: r.dates.length });
    case 'daily':
      return r.every === 1 ? t('scheduling.summary.daily') : t('scheduling.summary.everyNDays', { n: r.every });
    case 'weekly':
      return r.every === 1
        ? t('scheduling.summary.weekly', { days: weekdayList(r.weekdays, t) })
        : t('scheduling.summary.everyNWeeks', { n: r.every, days: weekdayList(r.weekdays, t) });
    case 'monthly': {
      const day =
        'dayOfMonth' in r.by
          ? t('scheduling.summary.dayOfMonth', { day: r.by.dayOfMonth })
          : t('scheduling.summary.nthWeekday', {
              nth: t(`scheduling.nth.${r.by.nth === -1 ? 'last' : r.by.nth}`),
              weekday: t(`scheduling.weekdays.${r.by.weekday}`),
            });
      return r.every === 1 ? t('scheduling.summary.monthly', { day }) : t('scheduling.summary.everyNMonths', { n: r.every, day });
    }
  }
}

function describeTime(timing: Timing, shiftName: string | null, t: Translate): string {
  if (timing.mode === 'shift') return t('scheduling.summary.shift', { shift: shiftName ?? '—' });
  if (timing.mode === 'anytime') return t('scheduling.summary.anytime');
  if (timing.mode === 'repeat') {
    // Several windows (feedback 2026-11-27): "08:00–12:00 arası hər 1 saatdan bir, 14:00–18:00 arası hər 30 dəqiqədən bir".
    return repeatWindows(timing)
      .map((w) => {
        const every =
          w.everyMinutes % 60 === 0
            ? t('scheduling.summary.everyHours', { n: w.everyMinutes / 60 })
            : t('scheduling.summary.everyMinutes', { n: w.everyMinutes });
        return t('scheduling.summary.repeat', { every, range: `${w.startTime}–${w.endTime}` });
      })
      .join(', ');
  }
  // Several times: each one's own window (feedback 2026-11-27), e.g. "08:00–10:00, 13:00–13:30".
  return fixedRuns(timing).map((run) => runWindow(run, t)).join(', ');
}

function runWindow(run: FixedRun, t: Translate): string {
  if (run.dueAfterMinutes === null) return t('scheduling.summary.noDeadline', { time: run.time });
  const end = timeToMinutes(run.time) + run.dueAfterMinutes;
  const range = `${run.time}–${minutesToTime(end)}`;
  const days = Math.floor(end / 1440);
  return days === 0 ? range : t('scheduling.summary.plusDays', { range, days });
}

/** A one-line human summary, e.g. "Hər həftə: B.e., Ç., 08:00–10:00". */
export function describeSchedule(r: Recurrence, timing: Timing, shiftName: string | null, t: Translate): string {
  return `${describeDays(r, t)}, ${describeTime(timing, shiftName, t)}`;
}
