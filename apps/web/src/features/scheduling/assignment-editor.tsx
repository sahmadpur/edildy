import { ApiError } from '@taskop/api-client';
import { type AssignmentDetail, expandSchedule, type PreviewAssignmentInput, type Recurrence, type Slot, type Timing } from '@taskop/contracts';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckboxList } from '@/components/checkbox-list';
import { Field, RequiredLegend } from '@/components/field';
import { FormError } from '@/components/form-error';
import { NativeSelect } from '@/components/native-select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSites } from '@/features/sites/queries';
import { errorText } from '@/lib/errors';
import { api, useMe } from '@/lib/session';
import { MonthCalendar } from '@/components/month-calendar';
import { monthGrid, monthOf } from '@/components/month-grid';
import { formatLocalDate, scheduleSummary, useDebounced, useTenantToday, useWindowText } from './labels';
import { useAssignableChecklists, useShifts, useSiteUsers } from './queries';
import { defaultRecurrence, defaultTiming, RecurrenceEditor, TimingEditor } from './schedule-builder';
import { useLocale } from '@/lib/i18n';
import { EmptyState } from '@/components/states';

export interface AssignmentEditorProps {
  initial?: AssignmentDetail;
  preset?: { checklistId?: string; copyFrom?: AssignmentDetail };
  /** For tests; defaults to today in the tenant timezone. */
  today?: string;
  onSaved: (a: AssignmentDetail) => void;
  onCancel: () => void;
}

/** Turns API errors into one line: schedule issues by text, user errors with the people's names. */
function describeError(t: TFunction, e: unknown, people: { id: string; fullName: string }[]): string {
  if (e instanceof ApiError && e.issues?.length) return e.issues.map((i) => t(i.code)).join(' ');
  if (e instanceof ApiError && e.userIds?.length) {
    const names = e.userIds.map((id) => people.find((p) => p.id === id)?.fullName ?? id).join(', ');
    return `${errorText(t, e)} (${names})`;
  }
  return errorText(t, e);
}

export function AssignmentEditor({ initial, preset, today: todayProp, onSaved, onCancel }: AssignmentEditorProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const tenantToday = useTenantToday();
  const today = todayProp ?? tenantToday;
  const windowText = useWindowText();
  const timeZone = useMe().tenant.timezone;
  const source = initial ?? preset?.copyFrom;
  const [name, setName] = useState(source?.name ?? '');
  const [checklistId, setChecklistId] = useState(source?.checklistId ?? preset?.checklistId ?? '');
  const [siteId, setSiteId] = useState(initial?.siteId ?? '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initial?.assignees.map((u) => u.id) ?? []);
  const [schedule, setSchedule] = useState<Recurrence>(source?.schedule ?? defaultRecurrence('daily', today));
  const [timing, setTiming] = useState<Timing>(source?.timing ?? defaultTiming('fixed', []));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const checklists = useAssignableChecklists();
  const sites = useSites();
  const users = useSiteUsers(siteId || null);
  const shifts = useShifts(siteId || null);
  const people = users.data ?? [];
  // Stored assignees who have since left the site or been deactivated: still listed so they can be unticked.
  const staleAssignees = users.data && siteId === initial?.siteId ? initial.assignees.filter((u) => !people.some((p) => p.id === u.id)) : [];
  const assigneeOptions = [
    ...people.map((u) => ({ value: u.id, label: u.fullName })),
    ...staleAssignees.map((u) => ({ value: u.id, label: `${u.fullName} (${t('scheduling.assignments.notAtSite')})` })),
  ];
  const shiftMissing = timing.mode === 'shift' && !timing.shiftId;
  const shiftName = timing.mode === 'shift' ? (shifts.data?.find((s) => s.id === timing.shiftId)?.name ?? null) : null;

  // Memoised so the debounce only restarts when the input really changes.
  const liveInput = useMemo<PreviewAssignmentInput | null>(
    () => (siteId && !shiftMissing ? { siteId, schedule, timing, assigneeIds } : null),
    [siteId, shiftMissing, schedule, timing, assigneeIds],
  );
  const previewInput = useDebounced(liveInput);
  const preview = useQuery({
    queryKey: ['assignments', 'preview', previewInput],
    queryFn: () => api.assignments.preview(previewInput!),
    enabled: previewInput !== null,
    retry: false,
  });

  // The calendar works the runs out here, for any month, from the same pure rule the server uses.
  const [month, setMonth] = useState(monthOf(today));
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const shiftHours = timing.mode === 'shift' ? (shifts.data?.find((s) => s.id === timing.shiftId) ?? null) : null;
  const calendar = useMemo(() => {
    const grid = monthGrid(month);
    const marks = new Map<string, number>();
    const byDay = new Map<string, { startsAt: string; dueAt: string }[]>();
    let slots: Slot[] = [];
    try {
      if (timing.mode !== 'shift' || shiftHours) slots = expandSchedule(schedule, timing, shiftHours, timeZone, grid[0]!, grid[grid.length - 1]!);
    } catch {
      slots = [];
    }
    for (const s of slots) {
      marks.set(s.localDate, (marks.get(s.localDate) ?? 0) + 1);
      byDay.set(s.localDate, [...(byDay.get(s.localDate) ?? []), { startsAt: s.startsAt.toISOString(), dueAt: s.dueAt.toISOString() }]);
    }
    return { marks, byDay };
  }, [month, schedule, timing, shiftHours, timeZone]);
  const skipped = useMemo(() => new Set(schedule.kind === 'once' || schedule.kind === 'dates' ? [] : schedule.skipDates), [schedule]);
  const firstUpcoming = preview.data?.slots[0]?.localDate ?? null;
  const day = pickedDay ?? (firstUpcoming && monthOf(firstUpcoming) === month ? firstUpcoming : null);

  const changeSite = (id: string) => {
    setSiteId(id);
    setAssigneeIds([]);
    if (timing.mode === 'shift') setTiming(defaultTiming('fixed', []));
  };

  const canSave = Boolean(checklistId && siteId && assigneeIds.length > 0 && !shiftMissing) && !saving;
  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const result = initial
        ? await api.assignments.update(initial.id, { revision: initial.revision, name: name.trim() || null, assigneeIds, schedule, timing })
        : await api.assignments.create({ name: name.trim() || null, checklistId, siteId, assigneeIds, schedule, timing });
      onSaved(result);
    } catch (e) {
      setError(describeError(t, e, [...people, ...(initial?.assignees ?? [])]));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid content-start gap-4">
        <RequiredLegend />
        <div className="grid gap-1.5">
          <Label htmlFor="assignment-name">{t('scheduling.assignments.name')}</Label>
          <Input id="assignment-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
        </div>
        <Field id="assignment-checklist" label={t('scheduling.assignments.checklist')} required empty={!checklistId}>
          <NativeSelect id="assignment-checklist" value={checklistId} aria-required disabled={Boolean(initial)} onChange={(e) => setChecklistId(e.target.value)}>
            <option value="">{t('scheduling.assignments.chooseChecklist')}</option>
            {initial && <option value={initial.checklistId}>{initial.checklistName}</option>}
            {(checklists.data ?? [])
              .filter((c) => c.id !== initial?.checklistId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field id="assignment-site" label={t('scheduling.assignments.site')} required empty={!siteId}>
          <NativeSelect id="assignment-site" value={siteId} aria-required disabled={Boolean(initial)} onChange={(e) => changeSite(e.target.value)}>
            <option value="">{t('scheduling.assignments.chooseSite')}</option>
            {(sites.data ?? [])
              .filter((s) => s.active || s.id === initial?.siteId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </NativeSelect>
        </Field>
        {siteId && (
          <CheckboxList
            label={t('scheduling.assignments.assignees')}
            options={assigneeOptions}
            value={assigneeIds}
            onChange={setAssigneeIds}
            required
          />
        )}
        <RecurrenceEditor value={schedule} onChange={setSchedule} today={today} />
        <TimingEditor value={timing} onChange={setTiming} shifts={shifts.data ?? []} />
        <FormError message={error} />
        <div className="flex gap-2">
          <Button onClick={() => void save()} disabled={!canSave}>
            {t('common.save')}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
      <aside aria-label={t('scheduling.assignments.preview')} className="grid content-start gap-3 bg-card shadow-card rounded-xl p-4">
        <h2 className="font-semibold">{t('scheduling.assignments.preview')}</h2>
        <p className="text-muted-foreground text-sm">{scheduleSummary(t, schedule, timing, shiftName)}</p>
        {/* A month calendar with a dot (or a count) on each day with runs (feedback 2026-11-08). */}
        <MonthCalendar
          label={t('scheduling.assignments.preview')}
          month={month}
          onMonthChange={setMonth}
          today={today}
          marks={calendar.marks}
          struck={skipped}
          active={day}
          onDayClick={setPickedDay}
        />
        {day && (
          <div className="grid gap-1 border-t pt-3">
            <h3 className="text-sm font-medium">{formatLocalDate(day, locale)}</h3>
            {(calendar.byDay.get(day) ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('scheduling.assignments.noRunsOnDay')}</p>
            ) : (
              <ol className="flex flex-wrap gap-1.5 text-xs tabular-nums">
                {calendar.byDay.get(day)!.map((s) => (
                  <li key={s.startsAt} className="bg-muted rounded-full px-2 py-0.5">
                    {windowText(s.startsAt, s.dueAt)}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        {preview.error && <p className="text-destructive text-sm">{errorText(t, preview.error)}</p>}
        {preview.data?.warnings.map((w) => (
          <Alert key={w}>
            <AlertDescription>{t(`scheduling.warnings.${w}`)}</AlertDescription>
          </Alert>
        ))}
        {preview.data && preview.data.slots.length === 0 && <EmptyState title={t('scheduling.assignments.previewEmpty')} />}
      </aside>
    </div>
  );
}
