import { localDateSchema } from '@taskop/contracts';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isPlainClick, PageTabs } from '@/components/page-tabs';
import { AssignmentDetailPage, AssignmentsPage, NewAssignmentPage } from './assignment-pages';
import { CalendarPage } from './calendar-page';
import { OCCURRENCE_TABS, type OccurrenceTab } from './occurrence-dialog';
import { RosterPage } from './roster-page';
import { ShiftsPage } from './shifts-page';
import { WorkTabs } from './work-tabs';

type TabPath = '/shifts' | '/roster';

/** Two sibling routes shown as the tabs of one page; the tab strip is a nav of links, so each keeps its URL. */
function RouteTabs({ label, tabs, active }: { label: string; tabs: readonly { to: TabPath; labelKey: string }[]; active: TabPath }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const go = (to: TabPath) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    void navigate({ to });
  };
  return <PageTabs label={label} tabs={tabs.map((tab) => ({ key: tab.to, label: t(tab.labelKey), href: tab.to, active: tab.to === active, onClick: go(tab.to) }))} />;
}

/** Növbə cədvəli first: the menu opens it (feedback 2026-11-11, item 11). */
const SHIFT_TABS = [
  { to: '/roster', labelKey: 'nav.roster' },
  { to: '/shifts', labelKey: 'nav.shifts' },
] as const;

function ShiftTabs({ active }: { active: '/shifts' | '/roster' }) {
  const { t } = useTranslation();
  return <RouteTabs label={t('scheduling.shifts.title')} tabs={SHIFT_TABS} active={active} />;
}

export function AssignmentsRoute() {
  return <AssignmentsPage tabs={<WorkTabs active="/assignments" />} />;
}

export function CalendarRoute() {
  const s = useSearch({ strict: false }) as ScheduleSearch;
  // A new link remounts the page, so its month and drawer replace the current ones.
  return (
    <CalendarPage key={`${s.date ?? ''}|${s.occurrence ?? ''}|${s.tab ?? ''}`} initialDate={s.date} initialOccurrenceId={s.occurrence} initialTab={s.tab} tabs={<WorkTabs active="/calendar" />} />
  );
}

export function ShiftsRoute() {
  return <ShiftsPage tabs={<ShiftTabs active="/shifts" />} />;
}

/** Switching to the Növbələr tab unmounts the roster, so an unsaved roster draft is dropped, as on any navigation. */
export function RosterRoute() {
  return <RosterPage tabs={<ShiftTabs active="/roster" />} />;
}

export function NewAssignmentRoute() {
  const s = useSearch({ strict: false }) as { checklistId?: string; copyFrom?: string };
  return <NewAssignmentPage checklistId={s.checklistId} copyFrom={s.copyFrom} />;
}

export function AssignmentDetailRoute() {
  const p = useParams({ strict: false }) as { assignmentId?: string };
  return <AssignmentDetailPage assignmentId={p.assignmentId!} />;
}

/**
 * `/calendar?date=YYYY-MM-DD&occurrence=<id>&tab=execution|audit|corrections`: the month to show and the run drawer to
 * open. Run links (notifications, e-mails, problems, tasks, audits) land here; the old `/schedule` page redirects here
 * with the same search (feedback 2026-11-11, item 7).
 */
export interface ScheduleSearch {
  date?: string;
  occurrence?: string;
  tab?: OccurrenceTab;
}

export const scheduleSearch = (s: Record<string, unknown>): ScheduleSearch => ({
  ...(localDateSchema.safeParse(s.date).success ? { date: s.date as string } : {}),
  ...(typeof s.occurrence === 'string' && s.occurrence ? { occurrence: s.occurrence } : {}),
  ...((OCCURRENCE_TABS as readonly unknown[]).includes(s.tab) ? { tab: s.tab as OccurrenceTab } : {}),
});


