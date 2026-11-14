import { useId } from 'react';
import { tabsTriggerClassName } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/**
 * One-of-a-few choice as a row of keys with an LED dot, in place of a dropdown (feedback 2026-11-14): the same look as
 * the tabs. Arrow keys move the choice, as in any radio group.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  className,
  showLabel = true,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  /** False when a visible label is already next to the control. */
  showLabel?: boolean;
}) {
  const id = useId();
  const move = (group: HTMLElement, step: number) => {
    const i = (options.findIndex((o) => o.value === value) + step + options.length) % options.length;
    const next = options[i];
    if (!next) return;
    onChange(next.value);
    group.querySelectorAll<HTMLButtonElement>('[role="radio"]')[i]?.focus();
  };
  return (
    <div className={cn('grid gap-1.5', className)}>
      {showLabel && (
        <span id={`${id}-label`} className="text-sm font-medium">
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-label={showLabel ? undefined : label}
        aria-labelledby={showLabel ? `${id}-label` : undefined}
        aria-disabled={disabled || undefined}
        className="tp-tabs-list inline-flex w-fit max-w-full flex-wrap items-center"
        onKeyDown={(e) => {
          const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
          if (disabled || step === 0) return;
          e.preventDefault();
          move(e.currentTarget, step);
        }}
      >
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              data-active={on ? '' : undefined}
              disabled={disabled}
              className={tabsTriggerClassName}
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
