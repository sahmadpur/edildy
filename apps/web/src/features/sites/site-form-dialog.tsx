import { zodResolver } from '@hookform/resolvers/zod';
import type { SiteDto, SiteTypeDto } from '@edildy/contracts';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { NativeSelect } from '@/components/native-select';
import { TextField } from '@/components/text-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { applyFieldErrors, errorText } from '@/lib/errors';

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  typeId: z.uuid(),
  address: z.string().trim().max(300),
});
export type SiteFormValues = z.output<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: SiteTypeDto[];
  site?: SiteDto;
  parent?: SiteDto | null;
  onSubmit: (values: SiteFormValues) => Promise<void>;
}

export function SiteFormDialog({ open, onOpenChange, types, site, parent, onSubmit }: Props) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const activeTypes = types.filter((ty) => ty.active || ty.id === site?.typeId);
  // A new place inside another starts one level down (Filial → Zona → Bölmə, feedback 2026-11-14); a new top-level one as the first type.
  const parentOrder = parent ? types.find((ty) => ty.id === parent.typeId)?.sortOrder : undefined;
  const nextLevel = parentOrder === undefined ? undefined : [...activeTypes].sort((x, y) => x.sortOrder - y.sortOrder).find((ty) => ty.sortOrder > parentOrder);
  const firstTypeId = site?.typeId ?? nextLevel?.id ?? activeTypes[0]?.id;
  // The dialog is mounted only while open, so the defaults are read once; `values` would re-sync (and wipe) the form
  // whenever the site types arrive after the user started typing.
  const form = useForm<z.input<typeof schema>, unknown, SiteFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: site?.name ?? '',
      typeId: firstTypeId ?? '',
      address: site?.address ?? '',
    },
  });
  const typeId = useWatch({ control: form.control, name: 'typeId' });
  // "Yeni zona" under a filial, not "Yeni filial" (feedback 2026-11-27): a new place is titled by the type picked.
  const pickedType = types.find((ty) => ty.id === typeId)?.name;
  const title = site
    ? t('sites.form.editTitle', { name: site.name })
    : pickedType
      ? t('sites.form.createTitleOf', { type: pickedType.toLocaleLowerCase(i18n.language) })
      : t('sites.form.createTitle');
  useEffect(() => {
    if (firstTypeId && !form.getValues('typeId')) form.setValue('typeId', firstTypeId);
  }, [firstTypeId, form]);
  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (e) {
      if (!applyFieldErrors(form, e)) setError(errorText(t, e));
    }
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          {parent && (
            <p className="text-muted-foreground text-sm">{t('sites.form.parent', { name: parent.name })}</p>
          )}
          <TextField form={form} name="name" label={t('sites.form.name')} required />
          <Field
            id="typeId"
            label={t('sites.form.type')}
            required
            empty={!typeId}
            error={form.formState.errors.typeId?.message ? t(form.formState.errors.typeId.message) : null}
          >
            <NativeSelect
              id="typeId"
              aria-required
              aria-invalid={Boolean(form.formState.errors.typeId)}
              {...form.register('typeId')}
            >
              {activeTypes.map((ty) => (
                <option key={ty.id} value={ty.id}>
                  {ty.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {/* Stored as `address`; shown as a free comment (feedback 2026-11-27). */}
          <div className="grid gap-1.5">
            <Label htmlFor="site-address">{t('sites.form.address')}</Label>
            <Textarea id="site-address" rows={2} maxLength={300} {...form.register('address')} />
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
