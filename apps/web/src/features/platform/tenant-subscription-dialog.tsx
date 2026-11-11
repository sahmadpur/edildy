import type { PlatformTenantDetail } from '@edildy/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormError } from '@/components/form-error';
import { ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorText } from '@/lib/errors';
import { platformApi } from './platform-session';
import { draftOf, parseDraft, SubscriptionFields, type SubscriptionDraft } from './subscription-fields';

/** An organisation's subscription (BR-01.02): plan, period, dates, branches, add-ons and limit overrides, with usage. */
export function TenantSubscriptionDialog({ tenantId, onClose, onSaved }: { tenantId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const detail = useQuery({ queryKey: ['platform', 'tenant', tenantId], queryFn: () => platformApi.tenants.get(tenantId) });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {detail.isPending && <LoadingState />}
        {detail.isError && <ErrorState message={errorText(t, detail.error)} onRetry={() => void detail.refetch()} />}
        {detail.data && <Editor tenant={detail.data} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function Editor({ tenant, onClose, onSaved }: { tenant: PlatformTenantDetail; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<SubscriptionDraft>(() => draftOf(tenant.subscription));
  const [invalid, setInvalid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setError(null);
    const parsed = parseDraft(draft);
    if (!parsed.ok) return setInvalid(parsed.field);
    setInvalid(null);
    setBusy(true);
    try {
      await platformApi.tenants.setSubscription(tenant.id, parsed.value);
      onSaved();
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('platform.subscription.title', { name: tenant.name })}</DialogTitle>
      </DialogHeader>
      <div className="bg-muted/40 grid gap-1 rounded-lg p-3 text-sm">
        <p className="font-medium">{t('platform.subscription.usage')}</p>
        <p>
          {t('subscription.staff')}: {tenant.usage.staff} · {t('subscription.workers')}: {tenant.usage.workers} · {t('subscription.branches')}: {tenant.usage.branches}
        </p>
        <p>
          {t('platform.subscription.owners')}:{' '}
          {tenant.owners.map((o) => `${o.fullName} (${o.email ?? '—'}${o.status === 'invited' ? `, ${t('platform.subscription.ownerInvited')}` : ''})`).join('; ') || '—'}
        </p>
      </div>
      <SubscriptionFields value={draft} onChange={setDraft} invalid={invalid} />
      <FormError message={error} />
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={() => void save()} disabled={busy}>
          {t('platform.subscription.save')}
        </Button>
      </DialogFooter>
    </>
  );
}
