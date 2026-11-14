import { TEMPLATE_CATEGORIES, type TemplateSource, type TemplateSummary, toListParam } from '@edildy/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { TabRow, tabActionClass } from '@/components/tab-row';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorText } from '@/lib/errors';
import { ChecklistTabs } from './checklist-tabs';
import { DetailsDialog } from './checklist-dialogs';
import { categoryLabel } from './labels';
import { NewChecklistDialog } from './new-checklist-dialog';
import { useTemplates } from './queries';
import { useWorkspace } from './workspace';
import { EmptyState } from '@/components/states';

export function TemplatesPage() {
  const { t } = useTranslation();
  const ws = useWorkspace();
  const qc = useQueryClient();
  const [source, setSource] = useState<TemplateSource>('global');
  const [category, setCategory] = useState<string[]>([]);
  const templates = useTemplates({ source, category: toListParam(category) });
  const [using, setUsing] = useState<TemplateSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: [ws.scope, 'templates'] });
    } catch (e) {
      toast.error(errorText(t, e));
    }
  };

  return (
    <div>
      <PageHeader title={t(ws.tabs === 'work' ? 'nav.assignments' : 'checklists.title')} description={t('pages.templates')} />
      <TabRow
        actions={
          ws.can.templates && (
            <button type="button" className={tabActionClass()} onClick={() => setCreating(true)}>
              {t('checklists.templates.new')}
            </button>
          )
        }
      >
        <ChecklistTabs active="templates" />
      </TabRow>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Pills: a filter inside the Şablonlar tab, not another row of page tabs. */}
        <Tabs value={source} onValueChange={(v) => setSource(v as TemplateSource)}>
          <TabsList variant="pill">
            <TabsTrigger value="global">{t('checklists.templates.edildy')}</TabsTrigger>
            <TabsTrigger value="tenant">{t('checklists.templates.ours')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <MultiSelectFilter
          label={t('checklists.filters.category')}
          allLabel={t('checklists.filters.allCategories')}
          options={TEMPLATE_CATEGORIES.map((c) => ({ value: c, label: t(`checklists.categories.${c}`) }))}
          value={category}
          onChange={setCategory}
          className="w-56"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(templates.data ?? []).map((tpl) => (
          <Card key={tpl.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {tpl.name}
                {tpl.status === 'deactivated' && <Badge variant="secondary">{t('checklists.statuses.deactivated')}</Badge>}
              </CardTitle>
              <CardDescription>
                {categoryLabel(t, tpl.category)} · {t('checklists.templates.items', { count: tpl.itemCount })}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {tpl.description && <p className="text-muted-foreground text-sm">{tpl.description}</p>}
              <div className="flex flex-wrap gap-2">
                {ws.can.manage && tpl.status === 'active' && (
                  <Button size="sm" onClick={() => setUsing(tpl)}>
                    {t('checklists.templates.use')}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => ws.go(`/templates/${tpl.source}/${tpl.id}`)}>
                  {tpl.source === 'tenant' && ws.can.templates && tpl.status === 'active' ? t('checklists.templates.editTemplate') : t('checklists.templates.preview')}
                </Button>
                {tpl.source === 'tenant' &&
                  ws.can.templates &&
                  (tpl.status === 'active' ? (
                    <Button size="sm" variant="ghost" onClick={() => void act(() => ws.templates.deactivate(tpl.id))}>
                      {t('common.deactivate')}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => void act(() => ws.templates.reactivate(tpl.id))}>
                      {t('common.reactivate')}
                    </Button>
                  ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.data?.length === 0 && <EmptyState title={t('checklists.templates.empty')} />}
      </div>
      {using && <NewChecklistDialog open initialMode="template" template={using} onOpenChange={(o) => !o && setUsing(null)} />}
      {creating && (
        <DetailsDialog
          title={t('checklists.templates.new')}
          submitLabel={t('common.create')}
          categoryRequired
          initial={{ name: '', description: null, category: null }}
          onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            const created = await ws.templates.create({ name: v.name, category: v.category!, ...(v.description ? { description: v.description } : {}) });
            ws.go(`/templates/tenant/${created.id}`);
          }}
        />
      )}
    </div>
  );
}
