import { toListParam } from '@taskop/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { PageHeader } from '@/components/page-header';
import { ConfirmButton } from '@/components/confirm-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { roleDisplayName, useRoles } from '@/features/roles/queries';
import { useFormatDateTime } from '@/lib/format';
import { toast } from 'sonner';
import { errorText } from '@/lib/errors';
import { api, useCan, useMe } from '@/lib/session';
import { CreateWorkerDialog } from './create-worker-dialog';
import { InviteStaffDialog } from './invite-staff-dialog';
import { useUsersInfinite } from './queries';
import { loginLabel, statusVariant } from './user-labels';

export function UsersPage() {
  const { t } = useTranslation();
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canManage = useCan('users.manage');
  const canSeeRoles = useCan('roles.view');
  const formatDateTime = useFormatDateTime();
  const roles = useRoles(canSeeRoles);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string[]>([]);
  const [roleId, setRoleId] = useState<string[]>([]);
  const q = useDeferredValue(search.trim());
  const users = useUsersInfinite({ q: q || undefined, status: toListParam(status), roleId: toListParam(roleId) });
  const [dialog, setDialog] = useState<'worker' | 'invite' | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });
  const rows = users.data?.pages.flatMap((p) => p.items) ?? [];
  const toggle = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await refresh();
    } catch (e) {
      toast.error(errorText(t, e));
    }
  };

  return (
    <div>
      <PageHeader
        title={t('users.title')} description={t('pages.users')}
        actions={
          canManage && (
            <>
              <Button variant="outline" onClick={() => setDialog('invite')}>
                {t('users.invite')}
              </Button>
              <Button onClick={() => setDialog('worker')}>{t('users.newWorker')}</Button>
            </>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input type="search" className="max-w-sm" placeholder={t('users.search')} aria-label={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <MultiSelectFilter
          label={t('users.columns.status')}
          allLabel={t('common.all')}
          options={(['active', 'invited', 'deactivated'] as const).map((s) => ({ value: s, label: t(`users.statuses.${s}`) }))}
          value={status}
          onChange={setStatus}
          className="w-48"
        />
        {canSeeRoles && (
          <MultiSelectFilter
            label={t('users.columns.role')}
            allLabel={t('common.all')}
            options={(roles.data ?? []).map((r) => ({ value: r.id, label: roleDisplayName(t, r) }))}
            value={roleId}
            onChange={setRoleId}
            className="w-56"
          />
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('users.columns.name')}</TableHead>
            <TableHead>{t('users.columns.login')}</TableHead>
            <TableHead>{t('users.columns.role')}</TableHead>
            <TableHead>{t('users.columns.status')}</TableHead>
            <TableHead>{t('users.columns.lastLogin')}</TableHead>
            {canManage && (
              <TableHead className="text-right">
                <span className="sr-only">{t('common.actions')}</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id} className="cursor-pointer" onClick={() => void navigate({ to: '/users/$userId', params: { userId: u.id } })}>
              <TableCell>
                <div className="font-medium">{u.fullName}</div>
                <div className="text-muted-foreground text-xs">{u.jobTitle ?? t(`users.kinds.${u.kind}`)}</div>
              </TableCell>
              <TableCell className="tabular-nums text-sm">{loginLabel(u)}</TableCell>
              <TableCell>{roleDisplayName(t, { name: u.role.name, systemKey: u.role.systemKey })}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(u.status)}>{t(`users.statuses.${u.status}`)}</Badge>
              </TableCell>
              <TableCell className="text-sm">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : t('users.never')}</TableCell>
              {canManage && (
                // Edit and deactivate in words at the end of the row (feedback 2026-11-07). The cell stops the click so the
                // buttons (and the confirm dialog, whose events bubble through React's tree) do not also open the row.
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => void navigate({ to: '/users/$userId', params: { userId: u.id } })}>
                      {t('common.edit')}
                    </Button>
                    {u.id !== me.user.id &&
                      (u.status === 'deactivated' ? (
                        <Button size="sm" variant="ghost" onClick={() => void toggle(() => api.users.reactivate(u.id))}>
                          {t('users.detail.reactivate')}
                        </Button>
                      ) : (
                        <ConfirmButton
                          size="sm"
                          variant="destructive"
                          label={t('users.detail.deactivate')}
                          title={t('users.detail.deactivate')}
                          description={t('users.detail.confirmDeactivate', { name: u.fullName })}
                          onConfirm={() => toggle(() => api.users.deactivate(u.id))}
                        />
                      ))}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
          {!users.isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={canManage ? 6 : 5} className="text-muted-foreground text-center">
                {t('users.empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {users.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" disabled={users.isFetchingNextPage} onClick={() => void users.fetchNextPage()}>
            {t('common.loadMore')}
          </Button>
        </div>
      )}
      <CreateWorkerDialog open={dialog === 'worker'} onOpenChange={(o) => setDialog(o ? 'worker' : null)} orgCode={me.tenant.orgCode} onCreated={() => void refresh()} />
      <InviteStaffDialog open={dialog === 'invite'} onOpenChange={(o) => setDialog(o ? 'invite' : null)} onInvited={() => void refresh()} />
    </div>
  );
}
