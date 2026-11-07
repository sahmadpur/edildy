import { type FieldValues, get, type Path, type UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field, isEmptyValue } from '@/components/field';
import { Input } from '@/components/ui/input';

interface TextFieldProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  type?: string;
  autoComplete?: string;
  description?: string;
  inputMode?: 'numeric' | 'text' | 'email';
  /** Marks the field with an asterisk and tags it "Boş" while nothing is typed. */
  required?: boolean;
}

export function TextField<T extends FieldValues>({ form, name, label, type = 'text', autoComplete, description, inputMode, required = false }: TextFieldProps<T>) {
  const { t } = useTranslation();
  const error = get(form.formState.errors, name)?.message as string | undefined;
  const value: unknown = useWatch({ control: form.control, name });
  return (
    <Field id={name} label={label} required={required} empty={isEmptyValue(value)} description={description} error={error ? t(error) : null}>
      <Input id={name} type={type} autoComplete={autoComplete} inputMode={inputMode} aria-required={required || undefined} aria-invalid={Boolean(error)} {...form.register(name)} />
    </Field>
  );
}
