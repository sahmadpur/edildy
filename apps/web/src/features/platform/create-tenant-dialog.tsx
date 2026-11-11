import { createTenantInputSchema, LOCALES } from '@edildy/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { NativeSelect } from '@/components/native-select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ApiError } from '@edildy/api-client';
import { errorText } from '@/lib/errors';
import { platformApi } from './platform-session';
import { newDraft, parseDraft, SubscriptionFields } from './subscription-fields';

/** "Yeni təşkilat": organisations are created here only (no self-registration); the owner is invited by e-mail. */
export function CreateTenantDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const [org, setOrg] = useState({ name: '', orgCode: '', timezone: 'Asia/Baku', locale: 'az', ownerName: '', ownerEmail: '' });
  const [sub, setSub] = useState(newDraft);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof org, v: string) => setOrg((o) => ({ ...o, [k]: v }));

  const submit = async () => {
    setError(null);
    setInvalid(null);
    const parsed = parseDraft(sub);
    if (!parsed.ok) return setInvalid(parsed.field);
    const body = { name: org.name, orgCode: org.orgCode, timezone: org.timezone, locale: org.locale, owner: { fullName: org.ownerName, email: org.ownerEmail }, subscription: parsed.value };
    const check = createTenantInputSchema.safeParse(body);
    if (!check.success) {
      const fields: Record<string, string> = {};
      for (const i of check.error.issues) fields[i.path.join('.')] = i.message.startsWith('errors.') ? i.message : 'errors.validation.invalid';
      return setFieldErrors(fields);
    }
    setFieldErrors({});
    setBusy(true);
    try {
      await platformApi.tenants.create(check.data);
      onCreated();
    } catch (e) {
      if (e instanceof ApiError && e.fields) setFieldErrors(Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k === 'email' ? 'owner.email' : k, v])));
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };
  const fe = (k: string) => (fieldErrors[k] ? t(fieldErrors[k]) : null);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('platform.create.title')}</DialogTitle>
          <DialogDescription>{t('platform.create.description')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="org-name" label={t('platform.create.name')} required empty={!org.name} error={fe('name')}>
            <Input id="org-name" value={org.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field id="org-code" label={t('platform.create.orgCode')} required empty={!org.orgCode} error={fe('orgCode')} description={t('platform.create.orgCodeHint')}>
            <Input id="org-code" value={org.orgCode} onChange={(e) => set('orgCode', e.target.value)} />
          </Field>
          <Field id="org-tz" label={t('platform.create.timezone')} required error={fe('timezone')}>
            <Input id="org-tz" value={org.timezone} onChange={(e) => set('timezone', e.target.value)} />
          </Field>
          <Field id="org-locale" label={t('platform.create.locale')} required>
            <NativeSelect id="org-locale" value={org.locale} onChange={(e) => set('locale', e.target.value)}>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="owner-name" label={t('platform.create.ownerName')} required empty={!org.ownerName} error={fe('owner.fullName')}>
            <Input id="owner-name" value={org.ownerName} onChange={(e) => set('ownerName', e.target.value)} />
          </Field>
          <Field id="owner-email" label={t('platform.create.ownerEmail')} required empty={!org.ownerEmail} error={fe('owner.email')}>
            <Input id="owner-email" type="email" value={org.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} />
          </Field>
        </div>
        <SubscriptionFields value={sub} onChange={setSub} invalid={invalid} />
        <FormError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {t('platform.create.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
