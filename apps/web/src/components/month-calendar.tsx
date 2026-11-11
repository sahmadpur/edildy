import { formatLocalDate, formatMonthYear } from '@edildy/i18n';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { addMonths, monthGrid, monthOf } from './month-grid';

export interface MonthCalendarProps {
  /** 'YYYY-MM' shown. */
  month: string;
  onMonthChange: (month: string) => void;
  /** Tenant-local today, ringed. Earlier days are muted. */
  today: string;
  /** Runs per day: a dot for one, the count for more. */
  marks?: ReadonlyMap<string, number>;
  /** Filled days (picked dates). */
  selected?: ReadonlySet<string>;
  /** Struck-through days (skipped dates). */
  struck?: ReadonlySet<string>;
  /** The day whose details are shown next to the calendar. */
  active?: string | null;
  onDayClick?: (date: string) => void;
  /** Accessible name of the whole calendar. */
  label: string;
  className?: string;
}

/**
 * A compact month calendar, Monday first (feedback 2026-11-08): shows where runs fall ("Növbəti yoxlamalar") and lets
 * dates be picked by clicking them. Day buttons are named by their date (and run count) for screen readers and tests.
 */
export function MonthCalendar({ month, onMonthChange, today, marks, selected, struck, active, onDayClick, label, className }: MonthCalendarProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const days = monthGrid(month);
  return (
    <div role="group" aria-label={label} className={cn('grid gap-2 select-none', className)}>
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t('scheduling.builder.prevMonth')} title={t('scheduling.builder.prevMonth')} onClick={() => onMonthChange(addMonths(month, -1))}>
          <ChevronLeft />
        </Button>
        <span className="text-sm font-semibold" aria-live="polite">
          {formatMonthYear(month, locale)}
        </span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t('scheduling.builder.nextMonth')} title={t('scheduling.builder.nextMonth')} onClick={() => onMonthChange(addMonths(month, 1))}>
          <ChevronRight />
        </Button>
      </div>
      <div className="text-muted-foreground grid grid-cols-7 text-center text-[11px] font-medium" aria-hidden>
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <span key={d}>{t(`scheduling.weekdaysShort.${d}`)}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((d) => {
          const inMonth = monthOf(d) === month;
          const count = marks?.get(d) ?? 0;
          const isSelected = selected?.has(d) ?? false;
          const isStruck = struck?.has(d) ?? false;
          const isActive = active === d;
          const past = d < today;
          const name = [formatLocalDate(d, locale), count > 0 ? t('scheduling.assignments.runsCount', { count }) : null].filter(Boolean).join(', ');
          return (
            <button
              key={d}
              type="button"
              aria-label={name}
              aria-pressed={selected ? isSelected : undefined}
              aria-current={d === today ? 'date' : undefined}
              disabled={!onDayClick}
              onClick={() => onDayClick?.(d)}
              className={cn(
                'relative mx-auto flex size-9 flex-col items-center justify-center rounded-full text-sm tabular-nums transition-colors',
                onDayClick && 'hover:bg-muted cursor-pointer disabled:cursor-default',
                !inMonth && 'text-muted-foreground/40',
                inMonth && past && !isSelected && 'text-muted-foreground',
                d === today && !isSelected && 'ring-primary ring-1 ring-inset font-semibold',
                isActive && !isSelected && 'bg-primary/10 text-primary font-semibold',
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90 font-semibold',
                isStruck && 'line-through decoration-2',
              )}
            >
              <span className="leading-none">{Number(d.slice(8, 10))}</span>
              {count > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute bottom-0.5 leading-none',
                    count === 1 ? 'size-1.5 rounded-full' : 'text-[9px] font-semibold',
                    count === 1 && (isSelected ? 'bg-primary-foreground' : past ? 'bg-muted-foreground/50' : 'bg-primary'),
                    count > 1 && (isSelected ? 'text-primary-foreground' : past ? 'text-muted-foreground' : 'text-primary'),
                  )}
                >
                  {count > 1 ? count : null}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
