import type { ProblemReportDto, ProblemReportStateFilter } from '@taskop/contracts';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NativeSelect } from '@/components/native-select';
import { EmptyState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { severityVariant } from '@/features/executions/labels';
import { useSites } from '@/features/sites/queries';
import { TaskDialog } from '@/features/tasks/task-dialog';
import { errorText } from '@/lib/errors';
import { useFormatDateTime } from '@/lib/format';
import { useCan } from '@/lib/session';
import { CloseReportDialog } from './close-report-dialog';
import { mapsLink, REPORT_STATE_FILTERS, reportStateVariant } from './labels';
import { type ReportFilters, useProblemReports } from './queries';
import { ReportMediaStrip } from './report-media';

const TEXT_MAX = 80;
const cut = (s: string) => (s.length > TEXT_MAX ? `${s.slice(0, TEXT_MAX)}…` : s);

/**
 * 2026-11-06 design §8: the Problems page's second tab. Reports in the caller's scope, by state (active by default),
 * site and date; a manager makes a task from an open one or closes it. `highlight` marks a row a notification opened.
 */
export function ReportsTab({ highlight }: { highlight?: string }) {
  const { t } = useTranslation();
  const formatDateTime = useFormatDateTime();
  const canManageTasks = useCan('tasks.manage');
  const sites = useSites();
  const [state, setState] = useState<ProblemReportStateFilter>('active');
  const [siteId, setSiteId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [taskFor, setTaskFor] = useState<ProblemReportDto | null>(null);
  const [closing, setClosing] = useState<ProblemReportDto | null>(null);
  const filters: ReportFilters = { state, siteId: siteId || undefined, from: from || undefined, to: to || undefined };
  const reports = useProblemReports(filters);
  const items = reports.data?.pages.flatMap((p) => p.items) ?? [];
  const highlighted = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    highlighted.current?.scrollIntoView?.({ block: 'center' });
  }, [items.length, highlight]);
  const c = (key: string) => t(`executions.reportsTab.columns.${key}`);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <NativeSelect aria-label={t('executions.reportsTab.state')} value={state} onChange={(e) => setState(e.target.value as ProblemReportStateFilter)} className="w-44">
          {REPORT_STATE_FILTERS.map((f) => (
            <option key={f} value={f}>
              {f === 'active' ? t('mobile.problems.filters.active') : t(`executions.reportStates.${f}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label={t('executions.reportsTab.site')} value={siteId} onChange={(e) => setSiteId(e.target.value)} className="w-52">
          <option value="">{t('executions.reportsTab.allSites')}</option>
          {(sites.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <div className="grid gap-1">
          <Label htmlFor="reports-from">{t('executions.reportsTab.from')}</Label>
          <Input id="reports-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="reports-to">{t('executions.reportsTab.to')}</Label>
          <Input id="reports-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </div>
      </div>
      {reports.isPending && <LoadingState />}
      {reports.error && <p className="text-destructive">{errorText(t, reports.error)}</p>}
      {reports.isSuccess && items.length === 0 && <EmptyState title={t('executions.reportsTab.empty')} />}
      {items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              {['date', 'site', 'reporter', 'severity', 'text', 'media', 'location', 'state'].map((k) => (
                <TableHead key={k}>{c(k)}</TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id} ref={r.id === highlight ? highlighted : undefined} data-highlight={r.id === highlight ? 'true' : undefined} className={r.id === highlight ? 'bg-accent/40' : undefined}>
                <TableCell>{formatDateTime(r.reportedAt)}</TableCell>
                <TableCell>{r.siteName}</TableCell>
                <TableCell>{r.reporter.fullName}</TableCell>
                <TableCell>
                  <Badge variant={severityVariant(r.severity)}>{t(`executions.severities.${r.severity}`)}</Badge>
                </TableCell>
                <TableCell className="max-w-xs" title={r.text}>
                  <p className="whitespace-pre-line">{cut(r.text)}</p>
                  <ReportMediaStrip media={r.media} />
                </TableCell>
                <TableCell>{r.media.length ? t('executions.reportsTab.mediaCount', { count: r.media.length }) : '—'}</TableCell>
                <TableCell>
                  {r.location ? (
                    <a href={mapsLink(r.location.lat, r.location.lng)} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      {t('executions.reportsTab.map')}
                    </a>
                  ) : (
                    <span title={t('executions.reportsTab.noLocation')}>—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="grid gap-1">
                    <Badge variant={reportStateVariant(r.state)} className="w-fit">
                      {t(`executions.reportStates.${r.state}`)}
                    </Badge>
                    {r.closeComment && <span className="text-muted-foreground text-xs">{r.closeComment}</span>}
                  </div>
                </TableCell>
                <TableCell>
                  {canManageTasks && r.state === 'open' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setTaskFor(r)}>
                        {t('executions.reportsTab.createTask')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setClosing(r)}>
                        {t('executions.reportsTab.close')}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {reports.hasNextPage && (
        <Button variant="outline" className="w-fit" disabled={reports.isFetchingNextPage} onClick={() => void reports.fetchNextPage()}>
          {t('executions.reportsTab.more')}
        </Button>
      )}
      {taskFor && <TaskDialog problemReport={taskFor} onClose={() => setTaskFor(null)} onSaved={() => void reports.refetch()} />}
      {closing && <CloseReportDialog report={closing} onClose={() => setClosing(null)} />}
    </div>
  );
}
