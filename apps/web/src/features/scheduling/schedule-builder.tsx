import {
  FIXED_MAX_TIMES,
  formatShiftRanges,
  isoWeekday,
  minutesToTime,
  REPEAT_MAX_WINDOWS,
  type RepeatWindow,
  timeToMinutes,
  validateTiming,
  type Recurrence,
  RECURRENCE_KINDS,
  type RecurrenceKind,
  SCHEDULING_LIMITS,
  type ShiftDto,
  TIMING_MODES,
  type Timing,
} from '@edildy/contracts';
import { Plus, Trash2, X } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NativeSelect } from '@/components/native-select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/field';
import { cn } from '@/lib/utils';
import { MonthCalendar } from '@/components/month-calendar';
import { monthOf } from '@/components/month-grid';
import { formatLocalDate } from './labels';
import { useLocale } from '@/lib/i18n';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const NTHS = [1, 2, 3, 4, -1] as const;

export function defaultRecurrence(kind: RecurrenceKind, today: string): Recurrence {
  const range = { startDate: today, endDate: null, skipDates: [] as string[] };
  switch (kind) {
    case 'once':
      return { kind, date: today };
    case 'daily':
      return { kind, every: 1, ...range };
    case 'weekly':
      return { kind, every: 1, weekdays: [isoWeekday(today)], ...range };
    case 'monthly':
      return { kind, every: 1, by: { dayOfMonth: Number(today.slice(8, 10)) }, ...range };
    case 'dates':
      return { kind, dates: [today] };
  }
}

export function defaultTiming(mode: Timing['mode'], shifts: ShiftDto[]): Timing {
  switch (mode) {
    case 'fixed':
      return { mode, startTime: '08:00', dueAfterMinutes: 120, graceMinutes: 60 };
    case 'shift':
      return { mode, shiftId: shifts.find((s) => s.active)?.id ?? '', graceMinutes: 0 };
    case 'anytime':
      return { mode };
    case 'repeat':
      return { mode, startTime: '08:00', endTime: '20:00', everyMinutes: 60 };
  }
}

/** Interval choices of "Gün ərzində təkrar", in minutes. */
const REPEAT_EVERY = [15, 30, 60, 120, 180, 240, 360] as const;

function NumberField({ id, label, value, min, max, onChange, hideLabel }: { id: string; label: string; value: number; min: number; max: number; onChange: (n: number) => void; hideLabel?: boolean }) {
  // The draft is what the user is typing; it re-syncs whenever `value` changes from outside.
  const [state, setState] = useState({ draft: String(value), seen: value });
  const draft = state.seen === value ? state.draft : String(value);
  const parse = (text: string) => {
    const n = Number(text);
    return text.trim() !== '' && Number.isInteger(n) ? n : null;
  };
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => {
          const text = e.target.value;
          const n = parse(text);
          if (n !== null && n >= min && n <= max) {
            setState({ draft: text, seen: n });
            if (n !== value) onChange(n);
          } else {
            setState({ draft: text, seen: value });
          }
        }}
        onBlur={() => {
          const n = parse(draft);
          const fixed = n === null ? value : Math.min(max, Math.max(min, n));
          setState({ draft: String(fixed), seen: fixed });
          if (fixed !== value) onChange(fixed);
        }}
      />
    </div>
  );
}

function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/**
 * Dates picked by clicking days in one month calendar (feedback 2026-11-08), instead of adding them one at a time.
 * Clicking a picked day unpicks it; `min` dates always stay. The picked dates are also listed as removable chips.
 */
function DatePickerCalendar({ label, values, min, today, onChange }: { label: string; values: string[]; min: number; today: string; onChange: (v: string[]) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [month, setMonth] = useState(monthOf(values[0] ?? today));
  const selected = new Set(values);
  const toggle = (d: string) => {
    if (selected.has(d)) {
      if (values.length > min) onChange(values.filter((x) => x !== d));
    } else onChange([...values, d].sort());
  };
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="grid gap-3 sm:grid-cols-[18rem_minmax(0,1fr)] sm:items-start">
        <MonthCalendar label={label} month={month} onMonthChange={setMonth} today={today} selected={selected} onDayClick={toggle} className="bg-card shadow-card rounded-xl p-3" />
        <div className="grid content-start gap-2">
          <p className="text-muted-foreground text-xs">{t('scheduling.builder.pickDatesHint')}</p>
          {values.length > 0 && <p className="text-sm font-medium">{t('scheduling.builder.selectedDates', { count: values.length })}</p>}
          <ul className="flex flex-wrap gap-1.5">
            {values.map((d) => (
              <li key={d} className="bg-muted flex items-center gap-0.5 rounded-full py-0.5 pr-0.5 pl-2.5 text-xs">
                <button type="button" className="hover:underline" onClick={() => setMonth(monthOf(d))}>
                  {formatLocalDate(d, locale)}
                </button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="rounded-full"
                  aria-label={`${t('scheduling.builder.remove')} ${d}`}
                  disabled={values.length <= min}
                  onClick={() => onChange(values.filter((x) => x !== d))}
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface RecurrenceEditorProps {
  value: Recurrence;
  onChange: (r: Recurrence) => void;
  today: string;
  disabled?: boolean;
}

export function RecurrenceEditor({ value, onChange, today, disabled }: RecurrenceEditorProps) {
  const { t } = useTranslation();
  const id = useId();
  const everyLabel = { daily: 'everyDays', weekly: 'everyWeeks', monthly: 'everyMonths' } as const;
  const maxEvery = { daily: 365, weekly: 52, monthly: 12 } as const;
  return (
    // No visible "Cədvəl" heading any more (feedback 2026-11-08); the fieldset keeps it as its accessible name.
    <fieldset className="grid gap-3" disabled={disabled} aria-label={t('scheduling.assignments.schedule')}>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-kind`}>{t('scheduling.builder.kind')}</Label>
        <NativeSelect id={`${id}-kind`} value={value.kind} onChange={(e) => onChange(defaultRecurrence(e.target.value as RecurrenceKind, today))}>
          {RECURRENCE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`scheduling.builder.kinds.${k}`)}
            </option>
          ))}
        </NativeSelect>
      </div>

      {value.kind === 'once' && <DateField id={`${id}-date`} label={t('scheduling.builder.date')} value={value.date} onChange={(date) => date && onChange({ ...value, date })} />}
      {value.kind === 'dates' && (
        <DatePickerCalendar label={t('scheduling.builder.dates')} values={value.dates} min={1} today={today} onChange={(dates) => onChange({ ...value, dates })} />
      )}

      {(value.kind === 'daily' || value.kind === 'weekly' || value.kind === 'monthly') && (
        <>
          <NumberField
            id={`${id}-every`}
            label={t(`scheduling.builder.${everyLabel[value.kind]}`)}
            value={value.every}
            min={1}
            max={maxEvery[value.kind]}
            onChange={(every) => onChange({ ...value, every })}
          />
          {value.kind === 'weekly' && (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">{t('scheduling.builder.weekdays')}</legend>
              <div className="flex flex-wrap gap-3">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`${id}-wd-${d}`}
                      checked={value.weekdays.includes(d)}
                      onCheckedChange={(c) => {
                        const set = new Set(value.weekdays);
                        if (c === true) set.add(d);
                        else if (set.size > 1) set.delete(d);
                        onChange({ ...value, weekdays: [...set].sort((a, b) => a - b) });
                      }}
                    />
                    <Label htmlFor={`${id}-wd-${d}`} className="font-normal">
                      {t(`scheduling.weekdays.${d}`)}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>
          )}
          {value.kind === 'monthly' && (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">{t('scheduling.builder.monthlyBy')}</legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name={`${id}-by`}
                    checked={'dayOfMonth' in value.by}
                    onChange={() => onChange({ ...value, by: { dayOfMonth: Number(value.startDate.slice(8, 10)) } })}
                  />
                  {t('scheduling.builder.byDay')}
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name={`${id}-by`} checked={'nth' in value.by} onChange={() => onChange({ ...value, by: { nth: 1, weekday: isoWeekday(value.startDate) } })} />
                  {t('scheduling.builder.byWeekday')}
                </label>
              </div>
              {'dayOfMonth' in value.by ? (
                <NumberField id={`${id}-dom`} label={t('scheduling.builder.dayOfMonth')} value={value.by.dayOfMonth} min={1} max={31} onChange={(dayOfMonth) => onChange({ ...value, by: { dayOfMonth } })} />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-nth`}>{t('scheduling.builder.nth')}</Label>
                    <NativeSelect
                      id={`${id}-nth`}
                      value={String(value.by.nth)}
                      onChange={(e) => 'nth' in value.by && onChange({ ...value, by: { ...value.by, nth: Number(e.target.value) as (typeof NTHS)[number] } })}
                    >
                      {NTHS.map((n) => (
                        <option key={n} value={n}>
                          {t(`scheduling.nth.${n === -1 ? 'last' : n}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-wd`}>{t('scheduling.builder.weekday')}</Label>
                    <NativeSelect
                      id={`${id}-wd`}
                      value={String(value.by.weekday)}
                      onChange={(e) => 'nth' in value.by && onChange({ ...value, by: { ...value.by, weekday: Number(e.target.value) } })}
                    >
                      {WEEKDAYS.map((d) => (
                        <option key={d} value={d}>
                          {t(`scheduling.weekdays.${d}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
              )}
            </fieldset>
          )}
          <div className="grid grid-cols-2 gap-3">
            <DateField id={`${id}-start`} label={t('scheduling.builder.startDate')} value={value.startDate} onChange={(startDate) => startDate && onChange({ ...value, startDate })} />
            <DateField id={`${id}-end`} label={t('scheduling.builder.endDate')} value={value.endDate ?? ''} onChange={(end) => onChange({ ...value, endDate: end || null })} />
          </div>
          <DatePickerCalendar label={t('scheduling.builder.skipDates')} values={value.skipDates} min={0} today={today} onChange={(skipDates) => onChange({ ...value, skipDates })} />
        </>
      )}
    </fieldset>
  );
}

interface TimingEditorProps {
  value: Timing;
  onChange: (t: Timing) => void;
  shifts: ShiftDto[];
  disabled?: boolean;
}

export function TimingEditor({ value, onChange, shifts, disabled }: TimingEditorProps) {
  const { t } = useTranslation();
  const id = useId();
  const max = SCHEDULING_LIMITS.maxExtendedWindowMinutes;
  return (
    <fieldset className="grid gap-3" disabled={disabled}>
      {/* Tick boxes side by side, one ticked at a time (feedback 2026-11-07), instead of a dropdown. */}
      <div role="group" aria-label={t('scheduling.builder.mode')} className="grid gap-1.5">
        <span className="text-sm font-medium">{t('scheduling.builder.mode')}</span>
        <div className="flex flex-wrap gap-2">
          {TIMING_MODES.map((mode) => (
            <label
              key={mode}
              htmlFor={`${id}-mode-${mode}`}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                value.mode === mode ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
              )}
            >
              <Checkbox
                id={`${id}-mode-${mode}`}
                checked={value.mode === mode}
                onCheckedChange={(c) => c === true && value.mode !== mode && onChange(defaultTiming(mode, shifts))}
              />
              {t(`scheduling.builder.modes.${mode}`)}
            </label>
          ))}
        </div>
      </div>
      {value.mode === 'anytime' ? (
        <p className="text-muted-foreground text-sm">{t('scheduling.builder.anytimeHint')}</p>
      ) : value.mode === 'repeat' ? (
        <RepeatWindows value={value} onChange={onChange} />
      ) : value.mode === 'fixed' ? (
        <FixedTimes value={value} onChange={onChange} max={max} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${id}-shift`} label={t('scheduling.builder.shift')} required empty={!value.shiftId}>
            <NativeSelect id={`${id}-shift`} value={value.shiftId} aria-required onChange={(e) => onChange({ ...value, shiftId: e.target.value })}>
              <option value="">{t('scheduling.builder.chooseShift')}</option>
              {shifts
                .filter((s) => s.active || s.id === value.shiftId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({formatShiftRanges(s.ranges, t('scheduling.shifts.nextDay'))})
                  </option>
                ))}
            </NativeSelect>
          </Field>
        </div>
      )}
    </fieldset>
  );
}

type FixedTiming = Extract<Timing, { mode: 'fixed' }>;

/**
 * "Sabit vaxt" with one or more start times (feedback 2026-11-14), each with its own "İcra müddəti" (feedback
 * 2026-11-27): one row per run, time then length. The grace ("Gecikmə icazəsi") is no longer asked: it keeps its
 * default, or the value an older assignment stored.
 */
function FixedTimes({ value, onChange, max }: { value: FixedTiming; onChange: (t: Timing) => void; max: number }) {
  const { t } = useTranslation();
  const id = useId();
  const extra = value.extraTimes ?? [];
  // `due: null` is "Müddətsiz" (feedback 2026-11-27): no deadline, the run stays open until it is done.
  const rows: { time: string; due: number | null }[] = [
    { time: value.startTime, due: value.dueAfterMinutes },
    ...extra.map((time, i) => {
      const own = value.extraDueAfterMinutes?.[i];
      return { time, due: own === undefined ? value.dueAfterMinutes : own };
    }),
  ];
  const set = (next: { time: string; due: number | null }[]) => {
    const [first, ...rest] = next;
    const { extraTimes: _times, extraDueAfterMinutes: _dues, ...base } = value;
    const head = { ...base, startTime: first!.time, dueAfterMinutes: first!.due };
    onChange(rest.length ? { ...head, extraTimes: rest.map((r) => r.time), extraDueAfterMinutes: rest.map((r) => r.due) } : head);
  };
  const last = rows[rows.length - 1]!;
  const nextRow = () => ({
    time: minutesToTime(Math.min(timeToMinutes(last.time) + Math.max(last.due ?? 60, 60), 23 * 60 + 59)),
    due: last.due ?? 60,
  });
  const setDue = (i: number, due: number | null) => set(rows.map((x, j) => (j === i ? { ...x, due } : x)));
  const many = rows.length > 1;
  const issues = validateTiming(value);
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5" role="group" aria-label={t('scheduling.builder.startTimes')}>
        <div className="text-muted-foreground grid grid-cols-[8rem_8rem] gap-2 text-sm font-medium">
          <span>{t(many ? 'scheduling.builder.startTimes' : 'scheduling.builder.startTime')}</span>
          <span>{t('scheduling.builder.dueAfter')}</span>
        </div>
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              id={i === 0 ? `${id}-start` : undefined}
              type="time"
              className="w-32"
              aria-label={many ? t('scheduling.builder.startTimeN', { n: i + 1 }) : t('scheduling.builder.startTime')}
              value={row.time}
              onChange={(e) => e.target.value && set(rows.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))}
            />
            {row.due === null ? (
              <div className="flex w-40 items-center gap-1">
                <span className="text-muted-foreground flex h-9 w-32 items-center rounded-md border border-dashed px-3 text-sm">
                  {t('scheduling.builder.noDeadline')}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={t('scheduling.builder.addDuration')}
                  title={t('scheduling.builder.addDuration')}
                  onClick={() => setDue(i, 60)}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex w-40 items-center gap-1">
                <div className="w-32">
                  <NumberField
                    id={`${id}-due-${i}`}
                    hideLabel
                    label={
                      many
                        ? t('scheduling.builder.dueAfterN', { n: i + 1 })
                        : t('scheduling.builder.dueAfter')
                    }
                    value={row.due}
                    min={1}
                    max={max}
                    onChange={(due) => setDue(i, due)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={t('scheduling.builder.removeDuration')}
                  title={t('scheduling.builder.removeDuration')}
                  onClick={() => setDue(i, null)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            )}
            {many && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('scheduling.builder.removeTime', { time: row.time })}
                title={t('scheduling.builder.removeTime', { time: row.time })}
                onClick={() => set(rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
        {rows.length < FIXED_MAX_TIMES && (
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => set([...rows, nextRow()])}>
              <Plus className="size-3.5" /> {t('scheduling.builder.addTime')}
            </Button>
          </div>
        )}
      </div>
      {rows.some((r) => r.due === null) && (
        <p className="text-muted-foreground text-sm">{t('scheduling.builder.noDeadlineHint')}</p>
      )}
      {issues.map((i) => (
        <p key={`${i.code}-${i.path.join('.')}`} className="text-destructive text-sm">
          {t(i.code)}
        </p>
      ))}
    </div>
  );
}

type RepeatTiming = Extract<Timing, { mode: 'repeat' }>;

/**
 * "Gün ərzində təkrar" with one or more start–end windows (feedback 2026-11-27), each with its own interval: one row
 * per window, start, end, then "Hər". The first row is the timing's own `startTime`/`endTime`/`everyMinutes`.
 */
function RepeatWindows({ value, onChange }: { value: RepeatTiming; onChange: (t: Timing) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const rows: RepeatWindow[] = [
    { startTime: value.startTime, endTime: value.endTime, everyMinutes: value.everyMinutes },
    ...(value.extraWindows ?? []),
  ];
  const set = (next: RepeatWindow[]) => {
    const [first, ...rest] = next;
    const { extraWindows: _windows, ...base } = value;
    const head = { ...base, ...first! };
    onChange(rest.length ? { ...head, extraWindows: rest } : head);
  };
  const setRow = (i: number, patch: Partial<RepeatWindow>) =>
    set(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const many = rows.length > 1;
  // A new window starts an hour after the latest end and lasts up to four hours, within the day.
  const nextRow = (): RepeatWindow => {
    const lastEnd = Math.max(...rows.map((r) => timeToMinutes(r.endTime)));
    const start = Math.min(lastEnd + 60, 22 * 60);
    return {
      startTime: minutesToTime(start),
      endTime: minutesToTime(Math.min(start + 240, 23 * 60 + 59)),
      everyMinutes: rows[rows.length - 1]!.everyMinutes,
    };
  };
  const label = (key: string, i: number) =>
    many ? `${t('scheduling.builder.windowN', { n: i + 1 })}: ${t(key)}` : t(key);
  const issues = validateTiming(value);
  return (
    <div className="grid gap-2">
      <div className="grid gap-1.5" role="group" aria-label={t('scheduling.builder.modes.repeat')}>
        <div
          className="text-muted-foreground grid grid-cols-[8rem_8rem_8rem] gap-2 text-sm font-medium"
          aria-hidden
        >
          <span>{t('scheduling.builder.startTime')}</span>
          <span>{t('scheduling.builder.endTime')}</span>
          <span>{t('scheduling.builder.every')}</span>
        </div>
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              id={i === 0 ? `${id}-rstart` : undefined}
              type="time"
              className="w-32"
              aria-label={label('scheduling.builder.startTime', i)}
              value={row.startTime}
              onChange={(e) => e.target.value && setRow(i, { startTime: e.target.value })}
            />
            <Input
              type="time"
              className="w-32"
              aria-label={label('scheduling.builder.endTime', i)}
              value={row.endTime}
              onChange={(e) => e.target.value && setRow(i, { endTime: e.target.value })}
            />
            <NativeSelect
              className="w-32"
              aria-label={label('scheduling.builder.every', i)}
              value={String(row.everyMinutes)}
              onChange={(e) => setRow(i, { everyMinutes: Number(e.target.value) })}
            >
              {REPEAT_EVERY.map((n) => (
                <option key={n} value={n}>
                  {n % 60 === 0
                    ? t('scheduling.builder.everyHoursOption', { n: n / 60 })
                    : t('scheduling.builder.everyMinutesOption', { n })}
                </option>
              ))}
            </NativeSelect>
            {many && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('scheduling.builder.removeWindow', {
                  range: `${row.startTime}–${row.endTime}`,
                })}
                title={t('scheduling.builder.removeWindow', { range: `${row.startTime}–${row.endTime}` })}
                onClick={() => set(rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
        {rows.length < REPEAT_MAX_WINDOWS && (
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => set([...rows, nextRow()])}>
              <Plus className="size-3.5" /> {t('scheduling.builder.addWindow')}
            </Button>
          </div>
        )}
      </div>
      {issues.length ? (
        [...new Set(issues.map((i) => i.code))].map((code) => (
          <p key={code} className="text-destructive text-sm">
            {t(code)}
          </p>
        ))
      ) : (
        <p className="text-muted-foreground text-sm">{t('scheduling.builder.repeatHint')}</p>
      )}
    </div>
  );
}
