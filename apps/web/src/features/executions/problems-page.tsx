import {
  PROBLEM_RESOLUTIONS,
  PROBLEM_SEVERITIES,
  PROBLEM_SOURCES,
  type ProblemDto,
  toListParam,
} from '@taskop/contracts';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatLocalDate, useTenantToday } from '@/features/scheduling/labels';
import { useSites } from '@/features/sites/queries';
import { resolutionVariant } from '@/features/tasks/labels';
import { ReportsTab } from '@/features/problem-reports/reports-tab';
import type { ProblemsSearch } from '@/features/problem-reports/routes';
import { TaskDialog } from '@/features/tasks/task-dialog';
import { errorText } from '@/lib/errors';
import { useCan } from '@/lib/session';
import { defaultProblemRange, problemRangeError, severityVariant } from './labels';
import { type ProblemFilters, useChecklistOptions, useProblems } from './queries';
import { useLocale } from '@/lib/i18n';
import { LoadingState, EmptyState } from '@/components/states';

/**
 * Recorded problems (spec §8 of SP4 and SP5). Each row opens its occurrence in the schedule drawer on the "İcra" tab;
 * its resolution links to its task, or offers to create one once the run is closed.
 */
export function ProblemsPage({ today: fixedToday, tab = 'checklist', report }: { today?: string } & ProblemsSearch) {
  const { t } = useTranslation();
  const locale = useLocale();
  const tenantToday = useTenantToday();
  const today = fixedToday ?? tenantToday;
  const canManageTasks = useCan('tasks.manage');
  const navigate = useNavigate();
  // Controlled: a notification link while the page is open changes only the search, and the tab must follow it
  // (state adjusted during render on a prop change, the React-sanctioned pattern).
  const [current, setCurrent] = useState<'checklist' | 'reports'>(tab);
  const [seenTab, setSeenTab] = useState(tab);
  if (seenTab !== tab) {
    setSeenTab(tab);
    setCurrent(tab);
  }
  const sites = useSites();
  const checklists = useChecklistOptions();
  const [range, setRange] = useState(() => defaultProblemRange(today));
  // Multi-select filters (feedback 2026-11-07): an empty list means all.
  const [siteId, setSiteId] = useState<string[]>([]);
  const [checklistId, setChecklistId] = useState<string[]>([]);
  const [severity, setSeverity] = useState<string[]>([]);
  const [source, setSource] = useState<string[]>([]);
  const [resolution, setResolution] = useState<string[]>([]);
  const [creatingFrom, setCreatingFrom] = useState<ProblemDto | null>(null);
  const [showCleared, setShowCleared] = useState(false);
  const rangeError = problemRangeError(range.from, range.to);
  const filters: ProblemFilters = {
    from: range.from,
    to: range.to,
    siteId: toListParam(siteId),
    checklistId: toListParam(checklistId),
    severity: toListParam(severity),
    source: toListParam(source),
    resolution: toListParam(resolution),
    // Part 1 decision 18: cleared problems are skipped unless asked for.
    ...(showCleared ? { includeCleared: 'true' } : {}),
  };
  const problems = useProblems(filters, rangeError === null);
  const items = problems.data?.pages.flatMap((p) => p.items) ?? [];
  const c = (key: string) => t(`executions.problemsPage.columns.${key}`);

  return (
    <div className="grid gap-4">
      <PageHeader title={t('executions.problemsPage.title')} description={t('pages.problems')} />
      <Tabs
        value={current}
        onValueChange={(v) => {
          const next = v === 'reports' ? 'reports' : 'checklist';
          setCurrent(next);
          void navigate({ to: '/problems', search: { tab: next } });
        }}
      >
        <TabsList>
          <TabsTrigger value="checklist">{t('executions.problemsPage.tabs.checklist')}</TabsTrigger>
          <TabsTrigger value="reports">{t('executions.problemsPage.tabs.reports')}</TabsTrigger>
        </TabsList>
        <TabsContent value="reports" className="mt-4">
          <ReportsTab highlight={report} />
        </TabsContent>
        <TabsContent value="checklist" className="mt-4 grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="problems-from">{t('executions.problemsPage.from')}</Label>
          <Input id="problems-from" type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="w-44" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="problems-to">{t('executions.problemsPage.to')}</Label>
          <Input id="problems-to" type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="w-44" />
        </div>
        <MultiSelectFilter
          label={t('executions.problemsPage.site')}
          allLabel={t('executions.problemsPage.allSites')}
          options={(sites.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          value={siteId}
          onChange={setSiteId}
          className="w-52"
        />
        <MultiSelectFilter
          label={t('executions.problemsPage.severity')}
          allLabel={t('executions.problemsPage.allSeverities')}
          options={PROBLEM_SEVERITIES.map((s) => ({ value: s, label: t(`executions.severities.${s}`) }))}
          value={severity}
          onChange={setSeverity}
          className="w-44"
        />
        <MultiSelectFilter
          label={t('executions.problemsPage.checklist')}
          allLabel={t('executions.problemsPage.allChecklists')}
          options={(checklists.data ?? []).map((cl) => ({ value: cl.id, label: cl.name }))}
          value={checklistId}
          onChange={setChecklistId}
          className="w-56"
        />
        <MultiSelectFilter
          label={t('executions.problemsPage.source')}
          allLabel={t('executions.problemsPage.allSources')}
          options={PROBLEM_SOURCES.map((s) => ({ value: s, label: t(`executions.problemSources.${s}`) }))}
          value={source}
          onChange={setSource}
          className="w-44"
        />
        <MultiSelectFilter
          label={t('tasks.problems.resolution')}
          allLabel={t('tasks.problems.allResolutions')}
          options={PROBLEM_RESOLUTIONS.map((r) => ({ value: r, label: t(`tasks.resolutions.${r}`) }))}
          value={resolution}
          onChange={setResolution}
          className="w-44"
        />
        <div className="flex h-9 items-center gap-2">
          <Checkbox id="problems-show-cleared" checked={showCleared} onCheckedChange={(c) => setShowCleared(c === true)} />
          <Label htmlFor="problems-show-cleared" className="font-normal">
            {t('corrections.web.showCleared')}
          </Label>
        </div>
      </div>
      {rangeError && <p className="text-destructive text-sm">{t(rangeError)}</p>}
      {!rangeError && problems.isPending && <LoadingState />}
      {!rangeError && problems.error && <p className="text-destructive">{errorText(t, problems.error)}</p>}
      {!rangeError && problems.isSuccess && items.length === 0 && <EmptyState title={t('executions.problemsPage.empty')} />}
      {!rangeError && items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              {['date', 'site', 'checklist', 'item', 'severity', 'source', 'note', 'executor', 'media'].map((k) => (
                <TableHead key={k}>{c(k)}</TableHead>
              ))}
              <TableHead>{t('tasks.problems.resolution')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.id} data-cleared={p.clearedAt ? 'true' : undefined} className={p.clearedAt ? 'opacity-60' : undefined}>
                <TableCell>{formatLocalDate(p.localDate, locale)}</TableCell>
                <TableCell>{p.siteName}</TableCell>
                <TableCell>{p.checklistName}</TableCell>
                <TableCell>
                  <Link
                    to="/schedule"
                    search={{ date: p.localDate, occurrence: p.occurrenceId, tab: 'execution' }}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {p.itemLabel ?? t('executions.problemsPage.unknownItem')}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={severityVariant(p.severity)}>{t(`executions.severities.${p.severity}`)}</Badge>
                    {p.clearedAt && <Badge variant="outline">{t('corrections.cleared')}</Badge>}
                  </div>
                </TableCell>
                <TableCell>{t(`executions.problemSources.${p.source}`)}</TableCell>
                <TableCell className="max-w-xs whitespace-pre-line">{p.note ?? '—'}</TableCell>
                <TableCell>{p.executorName}</TableCell>
                <TableCell>{p.mediaIds.length ? t('executions.problemsPage.mediaCount', { count: p.mediaIds.length }) : '—'}</TableCell>
                <TableCell>
                  <ResolutionCell problem={p} canCreate={canManageTasks && !p.clearedAt} onCreate={() => setCreatingFrom(p)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {!rangeError && problems.hasNextPage && (
        <Button variant="outline" className="w-fit" disabled={problems.isFetchingNextPage} onClick={() => void problems.fetchNextPage()}>
          {t('executions.problemsPage.more')}
        </Button>
      )}
      {/* Saving invalidates ['problems'] (storeTask), so the row then shows its open task. */}
      {creatingFrom && <TaskDialog problem={creatingFrom} onClose={() => setCreatingFrom(null)} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResolutionCell({ problem: p, canCreate, onCreate }: { problem: ProblemDto; canCreate: boolean; onCreate: () => void }) {
  const { t } = useTranslation();
  if (p.taskId) {
    return (
      <Badge asChild variant={resolutionVariant(p.resolution)}>
        <Link to="/tasks" search={{ task: p.taskId }}>
          {t(`tasks.resolutions.${p.resolution}`)}
        </Link>
      </Badge>
    );
  }
  if (!canCreate) return <Badge variant="outline">{t('tasks.resolutions.none')}</Badge>;
  // PROBLEM_NOT_CLOSED: only a completed or partial run's problems are frozen and can get a task (spec §1; ruling W5).
  const runOpen = !(p.executionState === 'completed' || p.executionState === 'partial');
  return (
    <span title={runOpen ? t('tasks.problems.runOpen') : undefined} className="inline-block">
      <Button size="sm" variant="outline" disabled={runOpen} onClick={onCreate}>
        {t('tasks.problems.create')}
      </Button>
    </span>
  );
}
