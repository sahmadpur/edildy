import { TEMPLATE_CATEGORIES, type TemplateSummary, toListParam } from '@edildy/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { cn } from '@/lib/utils';
import { categoryLabel } from './labels';
import { useTemplates } from './queries';
import { EmptyState } from '@/components/states';

export function TemplatePicker({ value, onPick }: { value: TemplateSummary | null; onPick: (t: TemplateSummary) => void }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string[]>([]);
  const templates = useTemplates({ status: 'active', category: toListParam(category) });
  return (
    <div className="grid gap-2">
      <MultiSelectFilter
        label={t('checklists.filters.category')}
        allLabel={t('checklists.filters.allCategories')}
        options={TEMPLATE_CATEGORIES.map((c) => ({ value: c, label: t(`checklists.categories.${c}`) }))}
        value={category}
        onChange={setCategory}
        className="w-full"
      />
      <div role="radiogroup" aria-label={t('checklists.create.pickTemplate')} className="grid max-h-64 gap-1 overflow-y-auto">
        {(templates.data ?? []).map((tpl) => (
          <button
            key={`${tpl.source}:${tpl.id}`}
            type="button"
            role="radio"
            aria-checked={value?.id === tpl.id}
            onClick={() => onPick(tpl)}
            className={cn('rounded-md border px-3 py-2 text-left text-sm', value?.id === tpl.id && 'border-primary bg-primary/5')}
          >
            <span className="font-medium">{tpl.name}</span>
            <span className="text-muted-foreground block text-xs">
              {tpl.source === 'global' ? t('checklists.templates.edildy') : t('checklists.templates.ours')} · {categoryLabel(t, tpl.category)} ·{' '}
              {t('checklists.templates.items', { count: tpl.itemCount })}
            </span>
          </button>
        ))}
        {templates.data?.length === 0 && <EmptyState title={t('checklists.templates.empty')} />}
      </div>
    </div>
  );
}
