import { TEMPLATE_CATEGORIES, type ChecklistStatus, type TemplateCategory } from '@taskop/contracts';
import { formatDateTime } from '@taskop/i18n';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/states';
import { ChecklistTabs } from './checklist-tabs';
import { categoryLabel } from './labels';
import { NewChecklistDialog } from './new-checklist-dialog';
import { useChecklistPages } from './queries';
import { useWorkspace, WsLink } from './workspace';
import { useLocale } from '@/lib/i18n';

export function ChecklistsPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const ws = useWorkspace();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ChecklistStatus | ''>('active');
  const [category, setCategory] = useState<TemplateCategory | ''>('');
  const q = useDeferredValue(search.trim());
  const pages = useChecklistPages({ q: q || undefined, status: status || undefined, category: category || undefined });
  const [creating, setCreating] = useState(false);
  const rows = pages.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      <PageHeader title={t(ws.tabs === 'work' ? 'nav.assignments' : 'checklists.title')} actions={ws.can.manage && <Button onClick={() => setCreating(true)}>{t('checklists.new')}</Button>} />
      <ChecklistTabs active="checklists" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input type="search" className="max-w-xs" placeholder={t('checklists.filters.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <NativeSelect aria-label={t('checklists.filters.status')} className="w-44" value={status} onChange={(e) => setStatus(e.target.value as ChecklistStatus | '')}>
          <option value="">{t('checklists.filters.allStatuses')}</option>
          <option value="active">{t('checklists.statuses.active')}</option>
          <option value="deactivated">{t('checklists.statuses.deactivated')}</option>
        </NativeSelect>
        <NativeSelect aria-label={t('checklists.filters.category')} className="w-52" value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory | '')}>
          <option value="">{t('checklists.filters.allCategories')}</option>
          {TEMPLATE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`checklists.categories.${c}`)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <WsLink to={`/checklists/${c.id}`}>{c.name}</WsLink>
                {c.status !== 'active' && <Badge variant="secondary">{t(`checklists.statuses.${c.status}`)}</Badge>}
                {c.draftRevision !== null && <Badge variant="outline">{t('checklists.draft')}</Badge>}
              </CardTitle>
              <CardDescription>
                <span>{categoryLabel(t, c.category)}</span> · <span>{c.currentVersionNumber ? t('checklists.versionN', { n: c.currentVersionNumber }) : t('checklists.notPublished')}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {c.description && <p className="text-muted-foreground text-sm">{c.description}</p>}
              <p className="text-muted-foreground text-xs tabular-nums">
                {t('checklists.updated')}: {formatDateTime(c.updatedAt, { locale, timeZone: ws.timeZone })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => ws.go(`/checklists/${c.id}`)}>
                  {t('checklists.open')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {pages.isSuccess && rows.length === 0 && <EmptyState title={t('checklists.empty')} />}
      {pages.hasNextPage && (
        <Button variant="outline" className="mt-3" disabled={pages.isFetchingNextPage} onClick={() => void pages.fetchNextPage()}>
          {t('common.loadMore')}
        </Button>
      )}
      {creating && <NewChecklistDialog open onOpenChange={setCreating} />}
    </div>
  );
}
