import { CALENDAR_STATUSES, type CalendarItem, type CalendarStatus, isWholeDayWindow, toListParam } from '@taskop/contracts';
import { formatLocalDate, formatMonthYear } from '@taskop/i18n';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addMonths, monthGrid, monthOf } from '@/components/month-grid';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSites } from '@/features/sites/queries';
import { errorText } from '@/lib/errors';
import { useLocale } from '@/lib/i18n';
import { api, useMe } from '@/lib/session';
import { cn } from '@/lib/utils';
import { occurrenceVariant, useTenantToday, useTimeFormat, useWindowText } from './labels';
import { OccurrenceDialog } from './occurrence-dialog';

/** Chips a day cell shows before "+N daha". */
const SHOWN_PER_DAY = 3;

/** Chip colours per status, from the brand's status set (text is always there too). */
function chipClass(s: CalendarStatus): string {
  switch (s) {
    case 'planned':
      return 'border border-dashed border-status-planned/60 text-muted-foreground bg-transparent';
    case 'pending':
      return 'status-chip-planned';
    case 'started':
    case 'in_progress':
      return 'status-chip-active';
    case 'completed':
    case 'audited':
      return 'status-chip-ok';
    case 'overdue':
    case 'partial':
    case 'correction_required':
      return 'status-chip-late';
    case 'missed':
      return 'status-chip-bad';
    case 'audit_pending':
      return 'status-chip-audit';
    case 'cancelled':
      return 'bg-muted text-muted-foreground line-through';
  }
}

const statusText = (t: (k: string) => string, s: CalendarStatus) => (s === 'planned' ? t('scheduling.calendar.planned') : t(`scheduling.statuses.${s}`));

/** The runs of one assignment on one day: a single chip, so an hourly check does not fill the cell. */
interface Group {
  key: string;
  items: CalendarItem[];
}

function groupDay(items: CalendarItem[]): Group[] {
  const byAssignment = new Map<string, CalendarItem[]>();
  for (const i of items) byAssignment.set(i.assignmentId, [...(byAssignment.get(i.assignmentId) ?? []), i]);
  return [...byAssignment.entries()].map(([key, list]) => ({ key, items: list })).sort((a, b) => (a.items[0]!.startsAt < b.items[0]!.startsAt ? -1 : 1));
}

const titleOf = (i: CalendarItem) => i.assignmentName ?? i.checklistName;

/** Outlook-like details of a chip: what, where, when, who, and how it went. */
function ChipDetails({ group, onOpen }: { group: Group; onOpen: (i: CalendarItem) => void }) {
  const { t } = useTranslation();
  const windowText = useWindowText();
  const first = group.items[0]!;
  const many = group.items.length > 1;
  const brief = !many ? first.executionBrief : null;
  return (
    <div className="grid gap-2">
      <div className="grid gap-0.5">
        <p className="font-semibold leading-tight">{titleOf(first)}</p>
        {first.assignmentName && <p className="text-muted-foreground text-xs">{first.checklistName}</p>}
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">{t('scheduling.calendar.site')}</dt>
        <dd>{first.siteName}</dd>
        {!many && (
          <>
            <dt className="text-muted-foreground">{t('scheduling.calendar.time')}</dt>
            <dd className="tabular-nums">{windowText(first.startsAt, first.dueAt)}</dd>
          </>
        )}
        {first.shiftName && (
          <>
            <dt className="text-muted-foreground">{t('scheduling.builder.shift')}</dt>
            <dd>{first.shiftName}</dd>
          </>
        )}
        <dt className="text-muted-foreground">{t('scheduling.calendar.assignees')}</dt>
        <dd>{first.assigneeNames.length ? first.assigneeNames.join(', ') : t('scheduling.calendar.noAssignees')}</dd>
        {brief && (
          <>
            <dt className="text-muted-foreground">{t('scheduling.calendar.executor')}</dt>
            <dd>{brief.executorName}</dd>
            <dt className="text-muted-foreground">{t('scheduling.calendar.progress')}</dt>
            <dd className="tabular-nums">{t('executions.progressShort', { answered: brief.progress.answered, total: brief.progress.total })}</dd>
            {brief.scorePercent !== null && (
              <>
                <dt className="text-muted-foreground">{t('scheduling.calendar.score')}</dt>
                <dd className="tabular-nums">{Math.round(brief.scorePercent)}%</dd>
              </>
            )}
          </>
        )}
      </dl>
      {many ? (
        <ul className="grid max-h-56 gap-1 overflow-y-auto">
          {group.items.map((i) => (
            <li key={i.startsAt}>
              <button type="button" onClick={() => onOpen(i)} className="hover:bg-muted flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left text-xs">
                <span className="tabular-nums">{windowText(i.startsAt, i.dueAt)}</span>
                <span className={cn('rounded-sm px-1.5 py-0.5 text-[10px] font-medium', chipClass(i.status))}>{statusText(t, i.status)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : first.status === 'planned' ? (
        <p className="text-muted-foreground text-xs">{t('scheduling.calendar.plannedHint')}</p>
      ) : (
        <Badge variant={occurrenceVariant(first.status)}>{statusText(t, first.status)}</Badge>
      )}
    </div>
  );
}

function Chip({ group, onOpen }: { group: Group; onOpen: (i: CalendarItem) => void }) {
  const { t } = useTranslation();
  const time = useTimeFormat();
  const timeZone = useMe().tenant.timezone;
  const first = group.items[0]!;
  const many = group.items.length > 1;
  // An "İstənilən vaxt" check has no start time worth showing (it would read 00:00).
  const wholeDay = isWholeDayWindow(first.startsAt, first.dueAt, timeZone);
  // A repeating check takes the colour of its most urgent run: missed, then late, then the rest in order.
  const shown = many ? (group.items.find((i) => i.status === 'missed') ?? group.items.find((i) => i.status === 'overdue') ?? first) : first;
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={() => onOpen(first)}
          className={cn('flex w-full min-w-0 items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] leading-tight transition-opacity hover:opacity-80', chipClass(shown.status))}
        >
          {!many && !wholeDay && <span className="shrink-0 font-semibold tabular-nums">{time(first.startsAt)}</span>}
          <span className="truncate">{titleOf(first)}</span>
          {many && <span className="ml-auto shrink-0 font-semibold tabular-nums">{t('scheduling.calendar.times', { count: group.items.length })}</span>}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80">
        <ChipDetails group={group} onOpen={onOpen} />
      </HoverCardContent>
    </HoverCard>
  );
}

const useFilterOptions = () => {
  const sites = useSites();
  const checklists = useQuery({ queryKey: ['checklists', 'calendar-options'], queryFn: async () => (await api.checklists.list({ limit: 200 })).items });
  const users = useQuery({ queryKey: ['users', 'calendar-options'], queryFn: async () => (await api.users.list({ status: 'active', limit: 200 })).items });
  return { sites: sites.data ?? [], checklists: checklists.data ?? [], users: users.data ?? [] };
};

/**
 * "Yoxlama cədvəli" (feedback 2026-11-08): a month of checks, stored runs and the planned ones after the 14-day
 * horizon, with hover details like an Outlook meeting. A run opens its drawer; a planned check opens its assignment.
 */
export function CalendarPage({ tabs }: { tabs?: ReactNode }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const today = useTenantToday();
  const options = useFilterOptions();
  const [month, setMonth] = useState(monthOf(today));
  const [siteId, setSiteId] = useState<string[]>([]);
  const [checklistId, setChecklistId] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [opened, setOpened] = useState<string | null>(null);
  const days = monthGrid(month);
  const from = days[0]!;
  const to = days[days.length - 1]!;
  const query = { from, to, siteId: toListParam(siteId), checklistId: toListParam(checklistId), assigneeId: toListParam(assigneeId), status: toListParam(status) };
  const calendar = useQuery({ queryKey: ['occurrences', 'calendar', query], queryFn: () => api.occurrences.calendar(query) });
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const i of calendar.data?.items ?? []) map.set(i.localDate, [...(map.get(i.localDate) ?? []), i]);
    return map;
  }, [calendar.data]);

  const open = (i: CalendarItem) => {
    if (i.occurrenceId) setOpened(i.occurrenceId);
    else void navigate({ to: '/assignments/$assignmentId', params: { assignmentId: i.assignmentId } });
  };

  return (
    <div className="grid gap-4">
      <div>
        <PageHeader title={t('nav.assignments')} description={t('pages.calendar')} />
        {tabs}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label={t('scheduling.calendar.prev')} title={t('scheduling.calendar.prev')} onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" onClick={() => setMonth(monthOf(today))}>
            {t('scheduling.calendar.today')}
          </Button>
          <Button variant="outline" size="icon" aria-label={t('scheduling.calendar.next')} title={t('scheduling.calendar.next')} onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight />
          </Button>
          <h2 className="ml-3 text-lg font-semibold" aria-live="polite">
            {formatMonthYear(month, locale)}
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <MultiSelectFilter
            label={t('scheduling.calendar.site')}
            allLabel={t('scheduling.calendar.allSites')}
            options={options.sites.map((s) => ({ value: s.id, label: s.name }))}
            value={siteId}
            onChange={setSiteId}
            className="w-48"
          />
          <MultiSelectFilter
            label={t('scheduling.calendar.checklist')}
            allLabel={t('scheduling.calendar.allChecklists')}
            options={options.checklists.map((c) => ({ value: c.id, label: c.name }))}
            value={checklistId}
            onChange={setChecklistId}
            className="w-48"
          />
          <MultiSelectFilter
            label={t('scheduling.calendar.assignee')}
            allLabel={t('scheduling.calendar.allAssignees')}
            options={options.users.map((u) => ({ value: u.id, label: u.fullName }))}
            value={assigneeId}
            onChange={setAssigneeId}
            className="w-48"
          />
          <MultiSelectFilter
            label={t('scheduling.calendar.status')}
            allLabel={t('scheduling.calendar.allStatuses')}
            options={CALENDAR_STATUSES.map((s) => ({ value: s, label: statusText(t, s) }))}
            value={status}
            onChange={setStatus}
            className="w-44"
          />
        </div>
      </div>
      {calendar.error && <p className="text-destructive text-sm">{errorText(t, calendar.error)}</p>}
      {calendar.data?.truncated && (
        <Alert>
          <AlertDescription>{t('scheduling.calendar.truncated')}</AlertDescription>
        </Alert>
      )}

      <div role="grid" aria-label={formatMonthYear(month, locale)} aria-busy={calendar.isFetching} className={cn('bg-card shadow-card overflow-hidden rounded-xl', calendar.isFetching && 'opacity-70 transition-opacity')}>
        <div role="row" className="bg-muted/40 grid grid-cols-7 border-b">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <div key={d} role="columnheader" className="text-muted-foreground px-2 py-2 text-xs font-medium">
              <span className="hidden md:inline">{t(`scheduling.weekdays.${d}`)}</span>
              <span className="md:hidden">{t(`scheduling.weekdaysShort.${d}`)}</span>
            </div>
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5].map((w) => (
          <div key={w} role="row" className="grid grid-cols-7 [&:not(:last-child)]:border-b">
            {days.slice(w * 7, w * 7 + 7).map((d) => {
              const groups = groupDay(byDay.get(d) ?? []);
              const inMonth = monthOf(d) === month;
              const isToday = d === today;
              const hidden = groups.length - SHOWN_PER_DAY;
              return (
                <div
                  key={d}
                  role="gridcell"
                  aria-label={formatLocalDate(d, locale)}
                  className={cn('flex min-h-28 min-w-0 flex-col gap-1 p-1.5 [&:not(:last-child)]:border-r', !inMonth && 'bg-muted/30', d < today && inMonth && 'bg-muted/10')}
                >
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center self-end rounded-full text-xs tabular-nums',
                      !inMonth && 'text-muted-foreground/50',
                      isToday && 'bg-primary text-primary-foreground font-semibold',
                    )}
                  >
                    {Number(d.slice(8, 10))}
                  </span>
                  {groups.slice(0, SHOWN_PER_DAY).map((g) => (
                    <Chip key={g.key} group={g} onOpen={open} />
                  ))}
                  {hidden > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-foreground px-1.5 text-left text-[11px] font-medium">
                          {t('scheduling.calendar.more', { count: hidden })}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="grid w-72 gap-1.5 p-3">
                        <p className="text-sm font-semibold">{t('scheduling.calendar.dayTitle', { date: formatLocalDate(d, locale) })}</p>
                        {groups.map((g) => (
                          <Chip key={g.key} group={g} onOpen={open} />
                        ))}
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {calendar.isSuccess && calendar.data.items.length === 0 && <EmptyState title={t('scheduling.calendar.empty')} />}

      <div aria-label={t('scheduling.calendar.legend')} className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">{t('scheduling.calendar.legend')}:</span>
        {(['planned', 'pending', 'in_progress', 'completed', 'overdue', 'missed', 'audit_pending'] as const).map((s) => (
          <span key={s} className={cn('rounded-sm px-1.5 py-0.5 text-[11px] font-medium', chipClass(s))}>
            {statusText(t, s)}
          </span>
        ))}
      </div>

      {opened && <OccurrenceDialog id={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}
