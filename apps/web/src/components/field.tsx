import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * The label row of a form field. A required field carries a saffron asterisk (drawn with CSS, so the label's text
 * stays the bare caption for tests and screen readers; the input says `aria-required` itself) and, while it is still
 * empty, a small "Boş" tag at the row's end that goes away as soon as something is typed.
 */
export function FieldLabel({ required, empty, className, children, ...props }: ComponentProps<typeof Label> & { required?: boolean; empty?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className={cn(required && "after:text-saffron after:ml-0.5 after:content-['*']", className)} {...props}>
        {children}
      </Label>
      {required && empty && <EmptyTag label={t('common.emptyField')} />}
    </div>
  );
}

/** The "Boş" tag on its own, for fields whose label is a legend or a custom control. */
export function EmptyTag({ label, className }: { label: string; className?: string }) {
  return <span className={cn('bg-status-late-soft text-status-late-text rounded-full px-1.5 py-px text-[11px] leading-4 font-medium', className)}>{label}</span>;
}

/**
 * A labelled field: the label row, the control, then its description or error. `data-field-empty` on the wrapper
 * tints the control while a required field is empty (styles.css), whatever the control is.
 */
export function Field({
  id,
  label,
  required = false,
  empty = false,
  error,
  description,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  required?: boolean;
  /** The control has no value yet. Only read with `required`. */
  empty?: boolean;
  /** Translated already. */
  error?: string | null;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('grid gap-1.5', className)} data-field-empty={required && empty ? 'true' : undefined}>
      <FieldLabel htmlFor={id} required={required} empty={empty}>
        {label}
      </FieldLabel>
      {children}
      {description && !error && <p className="text-muted-foreground text-xs">{description}</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

/** The one-line key to the asterisks, for the top of a longer form. */
export function RequiredLegend({ className }: { className?: string }) {
  const { t } = useTranslation();
  return <p className={cn('text-muted-foreground text-xs', className)}>{t('common.requiredLegend')}</p>;
}

/** True for '', null, undefined, whitespace and an empty list. */
export const isEmptyValue = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
