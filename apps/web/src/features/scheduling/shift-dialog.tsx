import { zodResolver } from '@hookform/resolvers/zod';
import { SHIFT_MAX_RANGES, type ShiftDto, type ShiftRange, shiftRangesSchema, type SiteDto } from '@taskop/contracts';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { NativeSelect } from '@/components/native-select';
import { TextField } from '@/components/text-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { applyFieldErrors, errorText } from '@/lib/errors';

const schema = z.object({ name: z.string().trim().min(1).max(100), ranges: shiftRangesSchema, siteId: z.string() });

export interface ShiftFormValues {
  name: string;
  /** One or more periods (feedback 2026-11-11, item 12): e.g. two hours in the morning and two in the evening. */
  ranges: ShiftRange[];
  siteId: string | null;
}

interface Props {
  shift?: ShiftDto;
  sites: SiteDto[];
  onClose: () => void;
  onSubmit: (values: ShiftFormValues) => Promise<void>;
}

export function ShiftDialog({ shift, sites, onClose, onSubmit }: Props) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: shift?.name ?? '', ranges: shift?.ranges.map((x) => ({ ...x })) ?? [{ startTime: '08:00', endTime: '16:00' }], siteId: shift?.siteId ?? '' },
  });
  const periods = useFieldArray({ control: form.control, name: 'ranges' });
  const ranges = useWatch({ control: form.control, name: 'ranges' });
  // The shift's own site is always an option, even when it is inactive or not loaded, so editing never clears it.
  const siteOptions =
    shift?.siteId && !sites.some((s) => s.id === shift.siteId)
      ? [{ id: shift.siteId, name: shift.siteName ?? shift.siteId }, ...sites]
      : sites;
  const fieldError = (i: number, name: 'startTime' | 'endTime') => form.formState.errors.ranges?.[i]?.[name]?.message;
  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await onSubmit({ ...v, siteId: v.siteId || null });
      onClose();
    } catch (e) {
      if (!applyFieldErrors(form, e)) setError(errorText(t, e));
    }
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{shift ? t('scheduling.shifts.editTitle') : t('scheduling.shifts.createTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <TextField form={form} name="name" label={t('scheduling.shifts.name')} required />
          <fieldset className="grid gap-3">
            <legend className="sr-only">{t('scheduling.shifts.hours')}</legend>
            {periods.fields.map((f, i) => {
              const range = ranges?.[i];
              const n = i + 1;
              return (
                <div key={f.id} role="group" aria-label={t('scheduling.shifts.range', { n })} className="grid gap-1">
                  <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                    {(['startTime', 'endTime'] as const).map((name) => {
                      const id = `ranges-${i}-${name}`;
                      const err = fieldError(i, name);
                      return (
                        <Field key={name} id={id} label={name === 'startTime' ? t('scheduling.shifts.start') : t('scheduling.shifts.end')} required empty={!range?.[name]} error={err ? t(err) : null}>
                          <Input id={id} type="time" aria-required aria-invalid={Boolean(err)} {...form.register(`ranges.${i}.${name}`)} />
                        </Field>
                      );
                    })}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('scheduling.shifts.removeRange', { n })}
                      title={t('scheduling.shifts.removeRange', { n })}
                      disabled={periods.fields.length === 1}
                      onClick={() => periods.remove(i)}
                      className={periods.fields.length === 1 ? 'invisible' : undefined}
                    >
                      <X />
                    </Button>
                  </div>
                  {range?.startTime && range.endTime && range.endTime < range.startTime && <p className="text-muted-foreground text-xs">{t('scheduling.shifts.nextDay')}</p>}
                </div>
              );
            })}
            {form.formState.errors.ranges?.root?.message && <p className="text-destructive text-sm">{t(form.formState.errors.ranges.root.message)}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" disabled={periods.fields.length >= SHIFT_MAX_RANGES} onClick={() => periods.append({ startTime: '', endTime: '' })}>
                <Plus />
                {t('scheduling.shifts.addRange')}
              </Button>
              {periods.fields.length > 1 && <p className="text-muted-foreground text-xs">{t('scheduling.shifts.rangesHint')}</p>}
            </div>
          </fieldset>
          <div className="grid gap-1.5">
            <Label htmlFor="siteId">{t('scheduling.shifts.site')}</Label>
            <NativeSelect id="siteId" {...form.register('siteId')}>
              <option value="">{t('scheduling.shifts.allSites')}</option>
              {siteOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
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
