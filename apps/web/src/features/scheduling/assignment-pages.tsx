import { ASSIGNMENT_STATUSES, type AssignmentDto, toListParam } from '@taskop/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { type ReactNode, useDeferredValue, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { ConfirmButton } from '@/components/confirm-button';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSites } from '@/features/sites/queries';
import { errorText } from '@/lib/errors';
import { api, useCan } from '@/lib/session';
import { AssignmentEditor } from './assignment-editor';
import { assignmentVariant, scheduleSummary } from './labels';
import { useAssignment, useAssignments } from './queries';
import { useLocale } from '@/lib/i18n';
import { LoadingState } from '@/components/states';

/** Pause, resume and cancel (end) an assignment, shared by the list rows and the assignment page. */
function useAssignmentActions() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  return async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['assignments'] });
    } catch (e) {
      toast.error(errorText(t, e));
    }
  };
}

/** Word actions in a Təyinatlar row (feedback 2026-11-08): Redaktə et opens the assignment page with its editor. */
function AssignmentRowActions({ a }: { a: AssignmentDto }) {
  const { t } = useTranslation();
  const act = useAssignmentActions();
  const title = a.name ?? a.checklistName;
  if (a.status === 'ended') return null;
  return (
    <div className="flex justify-end gap-1">
      <Link to="/assignments/$assignmentId" params={{ assignmentId: a.id }} className={buttonVariants({ variant: 'ghost', size: 'xs' })}>
        {t('scheduling.assignments.edit')}
      </Link>
      {a.status === 'active' ? (
        <Button variant="ghost" size="xs" onClick={() => void act(() => api.assignments.pause(a.id))}>
          {t('scheduling.assignments.pause')}
        </Button>
      ) : (
        <Button variant="ghost" size="xs" onClick={() => void act(() => api.assignments.resume(a.id))}>
          {t('scheduling.assignments.resume')}
        </Button>
      )}
      <ConfirmButton
        variant="ghost"
        size="xs"
        label={t('scheduling.assignments.end')}
        title={t('scheduling.assignments.end')}
        description={t('scheduling.assignments.confirmEnd', { name: title })}
        onConfirm={() => act(() => api.assignments.end(a.id))}
      />
    </div>
  );
}

export function AssignmentsPage({ tabs }: { tabs?: ReactNode } = {}) {
  const { t } = useTranslation();
  const canManage = useCan('assignments.manage');
  const sites = useSites();
  const [siteId, setSiteId] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>(['active']);
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const list = useAssignments({ siteId: toListParam(siteId), status: toListParam(status), q: q || undefined });
  const items = list.data?.items ?? [];

  return (
    <div>
      <PageHeader
        title={t(tabs ? 'nav.assignments' : 'scheduling.assignments.title')} description={t('pages.assignments')}
        actions={
          canManage && (
            <Link to="/assignments/new" className={buttonVariants()}>
              {t('scheduling.assignments.add')}
            </Link>
          )
        }
      />
      {tabs}
      <div className="mb-4 flex flex-wrap gap-3">
        <Input type="search" aria-label={t('common.search')} placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        <MultiSelectFilter
          label={t('scheduling.assignments.site')}
          allLabel={t('scheduling.assignments.allSites')}
          options={(sites.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          value={siteId}
          onChange={setSiteId}
          className="w-56"
        />
        <MultiSelectFilter
          label={t('common.status')}
          allLabel={t('scheduling.assignments.allStatuses')}
          options={ASSIGNMENT_STATUSES.map((s) => ({ value: s, label: t(`scheduling.assignments.status.${s}`) }))}
          value={status}
          onChange={setStatus}
          className="w-48"
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.name')}</TableHead>
            <TableHead>{t('scheduling.assignments.site')}</TableHead>
            <TableHead>{t('scheduling.assignments.schedule')}</TableHead>
            <TableHead>{t('scheduling.assignments.assignees')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            {canManage && <TableHead className="text-right">{t('common.actions')}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <Link to="/assignments/$assignmentId" params={{ assignmentId: a.id }} className="font-medium hover:underline">
                  {a.name ?? a.checklistName}
                </Link>
                {a.name && <div className="text-muted-foreground text-xs">{a.checklistName}</div>}
              </TableCell>
              <TableCell>{a.siteName}</TableCell>
              <TableCell>{scheduleSummary(t, a.schedule, a.timing, a.shiftName)}</TableCell>
              <TableCell>{t('scheduling.assignments.assigneeCount', { count: a.assignees.length })}</TableCell>
              <TableCell>
                <Badge variant={assignmentVariant(a.status)}>{t(`scheduling.assignments.status.${a.status}`)}</Badge>
              </TableCell>
              {canManage && (
                <TableCell>
                  <AssignmentRowActions a={a} />
                </TableCell>
              )}
            </TableRow>
          ))}
          {list.isSuccess && items.length === 0 && (
            <TableRow>
              <TableCell colSpan={canManage ? 6 : 5} className="text-muted-foreground text-center">
                {t('scheduling.assignments.empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/** "Aysel, Kamran və Lalə", or the first three and "daha 2 nəfər" for a longer list. */
export function peopleList(names: readonly string[], locale: string, t: TFunction): string {
  const SHOWN = 3;
  const parts = names.length > SHOWN ? [...names.slice(0, SHOWN), t('scheduling.assignments.morePeople', { count: names.length - SHOWN })] : [...names];
  return new Intl.ListFormat(locale, { type: 'conjunction' }).format(parts);
}

export function NewAssignmentPage({ checklistId, copyFrom }: { checklistId?: string; copyFrom?: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const source = useAssignment(copyFrom);
  if (copyFrom && source.isPending) return <LoadingState />;
  return (
    <div>
      <PageHeader title={t('scheduling.assignments.createTitle')} description={t('pages.newAssignment')} />
      <AssignmentEditor
        preset={{ checklistId, copyFrom: source.data }}
        onSaved={(a) => {
          // Say who it was made for (feedback 2026-11-07), then open it.
          toast.success(t('scheduling.assignments.createdFor', { names: peopleList(a.assignees.map((u) => u.fullName), locale, t) }));
          void navigate({ to: '/assignments/$assignmentId', params: { assignmentId: a.id } });
        }}
        onCancel={() => void navigate({ to: '/assignments' })}
      />
    </div>
  );
}

export function AssignmentDetailPage({ assignmentId }: { assignmentId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canManage = useCan('assignments.manage');
  const detail = useAssignment(assignmentId);
  const refresh = () => qc.invalidateQueries({ queryKey: ['assignments'] });
  const act = useAssignmentActions();

  if (detail.isPending) return <LoadingState />;
  if (detail.error) return <p className="text-destructive">{errorText(t, detail.error)}</p>;
  const a = detail.data;
  const title = a.name ?? a.checklistName;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={title}
        actions={
          canManage && (
            <>
              {a.status === 'active' && (
                <Button variant="outline" onClick={() => void act(() => api.assignments.pause(a.id))}>
                  {t('scheduling.assignments.pause')}
                </Button>
              )}
              {a.status === 'paused' && (
                <Button variant="outline" onClick={() => void act(() => api.assignments.resume(a.id))}>
                  {t('scheduling.assignments.resume')}
                </Button>
              )}
              {a.status !== 'ended' && (
                <ConfirmButton
                  variant="destructive"
                  label={t('scheduling.assignments.end')}
                  title={t('scheduling.assignments.end')}
                  description={t('scheduling.assignments.confirmEnd', { name: title })}
                  onConfirm={() => act(() => api.assignments.end(a.id))}
                />
              )}
              <Button variant="outline" onClick={() => void navigate({ to: '/assignments/new', search: { copyFrom: a.id } })}>
                {t('scheduling.assignments.copyToSites')}
              </Button>
            </>
          )
        }
      />
      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
        <Badge variant={assignmentVariant(a.status)}>{t(`scheduling.assignments.status.${a.status}`)}</Badge>
        <span>{a.checklistName}</span>
        <span>{a.siteName}</span>
        <span>{scheduleSummary(t, a.schedule, a.timing, a.shiftName)}</span>
      </div>
      {canManage && a.status !== 'ended' && (
        <AssignmentEditor
          key={a.revision}
          initial={a}
          onSaved={() => {
            toast.success(t('scheduling.assignments.saved'));
            void refresh();
          }}
          onCancel={() => void navigate({ to: '/assignments' })}
        />
      )}
    </div>
  );
}
