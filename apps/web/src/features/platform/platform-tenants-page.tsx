import { ApiError } from '@edildy/api-client';
import type { PlatformTenantDto } from '@edildy/contracts';
import { formatDateTime, formatLocalDate } from '@edildy/i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/confirm-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { errorText } from '@/lib/errors';
import { STATE_BADGE } from '@/features/subscription/subscription-tab';
import { CreateTenantDialog } from './create-tenant-dialog';
import { platformApi, platformSession, usePlatformAdmin } from './platform-session';
import { TenantSubscriptionDialog } from './tenant-subscription-dialog';
import { useLocale } from '@/lib/i18n';

interface TableProps {
  tenants: PlatformTenantDto[];
  onSubscription: (id: string) => void;
  onSuspend: (id: string) => Promise<void> | void;
  onReactivate: (id: string) => Promise<void> | void;
  onOpenChecklists: (id: string) => void;
}

export function PlatformTenantsTable({ tenants, onSubscription, onSuspend, onReactivate, onOpenChecklists }: TableProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('platform.tenants.name')}</TableHead>
          <TableHead>{t('platform.tenants.orgCode')}</TableHead>
          <TableHead>{t('platform.tenants.users')}</TableHead>
          <TableHead>{t('platform.tenants.plan')}</TableHead>
          <TableHead>{t('platform.tenants.endsOn')}</TableHead>
          <TableHead>{t('platform.tenants.created')}</TableHead>
          <TableHead>{t('platform.tenants.status')}</TableHead>
          <TableHead />
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenants.map((tn) => (
          <TableRow key={tn.id}>
            <TableCell className="font-medium">{tn.name}</TableCell>
            <TableCell className="tabular-nums">{tn.orgCode}</TableCell>
            <TableCell>{tn.userCount}</TableCell>
            <TableCell>
              <Button variant="link" className="h-auto p-0" onClick={() => onSubscription(tn.id)}>
                {t(`subscription.plans.${tn.plan}`)}
              </Button>
            </TableCell>
            <TableCell>
              <span className="flex items-center gap-2">
                {tn.endsOn ? formatLocalDate(tn.endsOn, locale) : t('platform.tenants.noEnd')}
                {tn.subscriptionState !== 'active' && <Badge variant={STATE_BADGE[tn.subscriptionState]}>{t(`subscription.states.${tn.subscriptionState}`)}</Badge>}
              </span>
            </TableCell>
            <TableCell>{formatDateTime(tn.createdAt, { locale, timeZone: 'Asia/Baku' })}</TableCell>
            <TableCell>
              <Badge variant={tn.status === 'active' ? 'default' : 'destructive'}>
                {t(`platform.tenants.${tn.status}`)}
              </Badge>
            </TableCell>
            <TableCell>
              <Button variant="link" className="h-auto p-0" onClick={() => onOpenChecklists(tn.id)}>
                {t('platform.tenants.checklists')}
              </Button>
            </TableCell>
            <TableCell className="text-right">
              {tn.status === 'active' ? (
                <ConfirmButton
                  variant="destructive"
                  label={t('platform.tenants.suspend')}
                  title={t('platform.tenants.suspend')}
                  description={t('platform.tenants.confirmSuspend', { name: tn.name })}
                  onConfirm={() => onSuspend(tn.id)}
                />
              ) : (
                <Button variant="outline" onClick={() => void onReactivate(tn.id)}>
                  {t('platform.tenants.reactivate')}
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function PlatformTenantsPage() {
  const { t } = useTranslation();
  const admin = usePlatformAdmin();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const q = useDeferredValue(search.trim());
  const tenants = useQuery({
    queryKey: ['platform', 'tenants', q],
    queryFn: async () => (await platformApi.tenants.list({ q: q || undefined, limit: 200 })).items,
    enabled: admin !== null,
  });
  useEffect(() => {
    if (tenants.error instanceof ApiError && tenants.error.code === 'UNAUTHENTICATED')
      void platformSession.signOut();
  }, [tenants.error]);
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['platform', 'tenants'] });
    } catch (e) {
      toast.error(errorText(t, e));
    }
  };
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('platform.tenants.title')}</h1>
        <Button onClick={() => setCreating(true)}>{t('platform.tenants.create')}</Button>
      </div>
      <Input
        type="search"
        className="max-w-sm"
        placeholder={t('platform.tenants.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <PlatformTenantsTable
        tenants={tenants.data ?? []}
        onSubscription={setEditing}
        onSuspend={(id) => act(() => platformApi.tenants.suspend(id))}
        onReactivate={(id) => act(() => platformApi.tenants.reactivate(id))}
        onOpenChecklists={(id) =>
          void navigate({ to: `/platform/tenants/${id}/checklists` as '/platform/tenants' })
        }
      />
      {creating && (
        <CreateTenantDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            toast.success(t('platform.create.created'));
            void qc.invalidateQueries({ queryKey: ['platform', 'tenants'] });
          }}
        />
      )}
      {editing && (
        <TenantSubscriptionDialog
          tenantId={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.success(t('platform.subscription.saved'));
            void qc.invalidateQueries({ queryKey: ['platform'] });
          }}
        />
      )}
    </div>
  );
}
