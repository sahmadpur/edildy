import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyTag } from '@/components/field';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** At least one must be ticked: asterisk on the legend, "Boş" tag while none is. */
  required?: boolean;
}

export function CheckboxList({ label, options, value, onChange, disabled, required = false }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [query, setQuery] = useState('');
  const visible = options.filter((o) => o.label.toLocaleLowerCase('az').includes(query.toLocaleLowerCase('az')));
  const toggle = (v: string, checked: boolean) => onChange(checked ? [...value, v] : value.filter((x) => x !== v));
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="flex w-full items-center justify-between gap-2 text-sm font-medium">
        <span className={cn(required && "after:text-saffron after:ml-0.5 after:content-['*']")}>{label}</span>
        {required && value.length === 0 && <EmptyTag label={t('common.emptyField')} />}
      </legend>
      <Input type="search" placeholder={t('common.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border p-3">
        {visible.length === 0 && <p className="text-muted-foreground text-sm">{t('common.noResults')}</p>}
        {visible.map((o) => (
          <div key={o.value} className="flex items-center gap-2">
            <Checkbox id={`${id}-${o.value}`} checked={value.includes(o.value)} onCheckedChange={(c) => toggle(o.value, c === true)} />
            <Label htmlFor={`${id}-${o.value}`} className="font-normal">
              {o.label}
            </Label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
