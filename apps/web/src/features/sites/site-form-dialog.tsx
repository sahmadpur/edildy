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
import { allowedTypes, levelOf, siteTypeLabel } from './site-types';

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
  /** Every place, to find an edited place's parent and children. */
  sites?: SiteDto[];
  onSubmit: (values: SiteFormValues) => Promise<void>;
}

export function SiteFormDialog({ open, onOpenChange, types, site, parent, sites = [], onSubmit }: Props) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  // Levels (feedback 2026-11-27): only types below the parent (only Filial at the top) and above the children. A new
  // place starts at the next level down (Filial → Zona → Bölmə, feedback 2026-11-14).
  const under = site ? (sites.find((x) => x.id === site.parentId) ?? null) : (parent ?? null);
  const childLevels = site ? sites.filter((x) => x.parentId === site.id).flatMap((x) => levelOf(types, x.typeId) ?? []) : [];
  const options = allowedTypes(types, under, childLevels, site?.typeId);
  const firstTypeId = site?.typeId ?? options[0]?.id;
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
  const pickedName = types.find((ty) => ty.id === typeId)?.name;
  const pickedType = pickedName === undefined ? undefined : siteTypeLabel(t, pickedName);
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
              {options.map((ty) => (
                <option key={ty.id} value={ty.id}>
                  {siteTypeLabel(t, ty.name)}
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
