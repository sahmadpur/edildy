import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  /** The filter's name: the trigger's accessible name ("Obyekt"). */
  label: string;
  /** The first tick, on by default: "Bütün obyektlər". */
  allLabel: string;
  options: readonly FilterOption[];
  /** The ticked values; empty means all. */
  value: readonly string[];
  onChange: (next: string[]) => void;
  className?: string;
  disabled?: boolean;
}

const SEARCH_FROM = 8;

/**
 * An Excel-style filter: a select-looking box that opens a list of tick boxes (feedback 2026-11-07). The first tick is
 * "all" and is on by default; ticking an option turns it off, and unticking the last option (or ticking every one) turns
 * it back on. The box reads the "all" label, the one ticked name, or the first name with "+N".
 */
export function MultiSelectFilter({ label, allLabel, options, value, onChange, className, disabled }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [query, setQuery] = useState('');
  const selected = value.filter((v) => options.some((o) => o.value === v));
  const all = selected.length === 0;
  const names = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
  const summary = all ? allLabel : names.length === 1 ? names[0]! : `${names[0]} +${names.length - 1}`;
  const needle = query.trim().toLocaleLowerCase('az');
  const visible = needle ? options.filter((o) => o.label.toLocaleLowerCase('az').includes(needle)) : options;

  const toggle = (v: string, checked: boolean) => {
    const next = checked ? [...selected, v] : selected.filter((x) => x !== v);
    // Every option ticked is the same as "all": keep the URL and the request short.
    onChange(next.length === options.length ? [] : next);
  };

  return (
    <Popover onOpenChange={(open) => !open && setQuery('')}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={all ? allLabel : names.join(', ')}
          disabled={disabled}
          className={cn(
            'border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm focus-visible:ring-3 focus-visible:outline-none disabled:opacity-50',
            className,
          )}
        >
          <span className="truncate">{summary}</span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="grid w-72 gap-2 p-3">
        {options.length > SEARCH_FROM && (
          <Input type="search" aria-label={t('common.search')} placeholder={t('common.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        )}
        <div role="group" aria-label={label} className="grid max-h-72 gap-2 overflow-y-auto">
          <div className="flex items-center gap-2 border-b pb-2">
            <Checkbox id={`${id}-all`} checked={all} onCheckedChange={(c) => c === true && onChange([])} />
            <Label htmlFor={`${id}-all`} className="font-medium">
              {allLabel}
            </Label>
          </div>
          {visible.length === 0 && <p className="text-muted-foreground text-sm">{t('common.noResults')}</p>}
          {visible.map((o) => (
            <div key={o.value} className="flex items-center gap-2">
              <Checkbox id={`${id}-${o.value}`} checked={selected.includes(o.value)} onCheckedChange={(c) => toggle(o.value, c === true)} />
              <Label htmlFor={`${id}-${o.value}`} className="font-normal">
                {o.label}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
