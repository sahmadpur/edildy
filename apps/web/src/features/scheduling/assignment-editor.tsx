import { ApiError } from '@edildy/api-client';
import { type AssignmentDetail, expandSchedule, type SiteDto, type PreviewAssignmentInput, type Recurrence, type Slot, type Timing } from '@edildy/contracts';
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
import { useSites, useSiteTypes } from '@/features/sites/queries';
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

/**
 * Where a check happens (feedback 2026-11-14): first the branch (Filial), then a zone or section inside it.
 * A branch is the top of what the user can see; its active descendants are the places to choose from.
 */
function branchesOf(sites: SiteDto[]) {
  const ids = new Set(sites.map((s) => s.id));
  return sites.filter((s) => !s.parentId || !ids.has(s.parentId));
}
const isUnder = (site: SiteDto, branch: SiteDto) => Boolean(site.path && branch.path && site.path.startsWith(`${branch.path}.`));

/** The branch, the places inside it and the site the assignment goes to; one branch (the usual case) is picked for the user. */
function placeOf(all: SiteDto[], siteId: string, branchId: string, initialSiteId: string | undefined) {
  const visible = all.filter((s) => s.active || s.id === initialSiteId);
  const branches = branchesOf(visible);
  const stored = visible.find((s) => s.id === siteId);
  const branch =
    branches.find((b) => b.id === branchId) ??
    (stored ? branches.find((b) => b.id === stored.id || isUnder(stored, b)) : undefined) ??
    (branches.length === 1 ? branches[0] : undefined);
  const locations = branch ? visible.filter((s) => isUnder(s, branch)) : [];
  // A branch without zones yet: the check goes to the branch itself.
  const effectiveSiteId = siteId || (branch && locations.length === 0 ? branch.id : '');
  return { branches, branch, locations, effectiveSiteId };
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
  const [branchId, setBranchId] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initial?.assignees.map((u) => u.id) ?? []);
  const [schedule, setSchedule] = useState<Recurrence>(source?.schedule ?? defaultRecurrence('daily', today));
  const [timing, setTiming] = useState<Timing>(source?.timing ?? defaultTiming('fixed', []));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const checklists = useAssignableChecklists();
  const sites = useSites();
  const siteTypes = useSiteTypes();
  const { branches, branch, locations, effectiveSiteId } = useMemo(() => placeOf(sites.data ?? [], siteId, branchId, initial?.siteId), [sites.data, siteId, branchId, initial?.siteId]);
  const typeName = (s: SiteDto) => siteTypes.data?.find((ty) => ty.id === s.typeId)?.name;
  const users = useSiteUsers(effectiveSiteId || null);
  const shifts = useShifts(effectiveSiteId || null);
  const people = users.data ?? [];
  // Stored assignees who have since left the site or been deactivated: still listed so they can be unticked.
  const staleAssignees = users.data && effectiveSiteId === initial?.siteId ? initial.assignees.filter((u) => !people.some((p) => p.id === u.id)) : [];
  const assigneeOptions = [
    ...people.map((u) => ({ value: u.id, label: u.fullName })),
    ...staleAssignees.map((u) => ({ value: u.id, label: `${u.fullName} (${t('scheduling.assignments.notAtSite')})` })),
  ];
  const shiftMissing = timing.mode === 'shift' && !timing.shiftId;
  const shiftName = timing.mode === 'shift' ? (shifts.data?.find((s) => s.id === timing.shiftId)?.name ?? null) : null;

  // Memoised so the debounce only restarts when the input really changes.
  const liveInput = useMemo<PreviewAssignmentInput | null>(
    () => (effectiveSiteId && !shiftMissing ? { siteId: effectiveSiteId, schedule, timing, assigneeIds } : null),
    [effectiveSiteId, shiftMissing, schedule, timing, assigneeIds],
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

  const changeBranch = (id: string) => {
    setBranchId(id);
    changeSite('');
  };
  const changeSite = (id: string) => {
    setSiteId(id);
    setAssigneeIds([]);
    if (timing.mode === 'shift') setTiming(defaultTiming('fixed', []));
  };

  const canSave = Boolean(checklistId && effectiveSiteId && assigneeIds.length > 0 && !shiftMissing) && !saving;
  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const result = initial
        ? await api.assignments.update(initial.id, { revision: initial.revision, name: name.trim() || null, assigneeIds, schedule, timing })
        : await api.assignments.create({ name: name.trim() || null, checklistId, siteId: effectiveSiteId, assigneeIds, schedule, timing });
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="assignment-branch" label={t('scheduling.assignments.site')} required empty={!branch}>
            <NativeSelect
              id="assignment-branch"
              value={branch?.id ?? ''}
              aria-required
              disabled={Boolean(initial) || branches.length <= 1}
              onChange={(e) => changeBranch(e.target.value)}
            >
              {!branch && <option value="">{t('scheduling.assignments.chooseSite')}</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {branch && locations.length > 0 && (
            <Field id="assignment-site" label={t('scheduling.assignments.location')} required empty={!siteId}>
              <NativeSelect id="assignment-site" value={siteId} aria-required disabled={Boolean(initial)} onChange={(e) => changeSite(e.target.value)}>
                <option value="">{t('scheduling.assignments.chooseLocation')}</option>
                {initial && siteId === branch.id && <option value={branch.id}>{branch.name}</option>}
                {locations.map((s) => {
                  const type = typeName(s);
                  const indent = '\u00a0\u00a0'.repeat(Math.max(0, s.depth - branch.depth - 1));
                  return (
                    <option key={s.id} value={s.id}>
                      {indent}
                      {s.name}
                      {type ? ` · ${type}` : ''}
                    </option>
                  );
                })}
              </NativeSelect>
            </Field>
          )}
        </div>
        {branch && locations.length === 0 && !initial && <p className="text-muted-foreground text-sm">{t('scheduling.assignments.noLocations')}</p>}
        {effectiveSiteId && (
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
