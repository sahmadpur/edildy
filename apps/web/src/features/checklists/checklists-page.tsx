import { type ChecklistStatus, TEMPLATE_CATEGORIES, toListParam } from '@edildy/contracts';
import { formatDateTime } from '@edildy/i18n';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { TabRow, tabActionClass } from '@/components/tab-row';
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

const CHECKLIST_STATUSES: readonly ChecklistStatus[] = ['active', 'deactivated'];

export function ChecklistsPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const ws = useWorkspace();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string[]>(['active']);
  const [category, setCategory] = useState<string[]>([]);
  const q = useDeferredValue(search.trim());
  const pages = useChecklistPages({
    q: q || undefined,
    status: toListParam(status),
    category: toListParam(category),
  });
  const [creating, setCreating] = useState(false);
  const rows = pages.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      <PageHeader
        title={t(ws.tabs === 'work' ? 'nav.assignments' : 'checklists.title')} description={t('pages.checklists')}
      />
      <TabRow
        actions={
          ws.can.manage && (
            <button type="button" className={tabActionClass()} onClick={() => setCreating(true)}>
              {t('checklists.new')}
            </button>
          )
        }
      >
        <ChecklistTabs active="checklists" />
      </TabRow>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          type="search"
          className="max-w-xs"
          placeholder={t('checklists.filters.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <MultiSelectFilter
          label={t('checklists.filters.status')}
          allLabel={t('checklists.filters.allStatuses')}
          options={CHECKLIST_STATUSES.map((s) => ({ value: s, label: t(`checklists.statuses.${s}`) }))}
          value={status}
          onChange={setStatus}
          className="w-44"
        />
        <MultiSelectFilter
          label={t('checklists.filters.category')}
          allLabel={t('checklists.filters.allCategories')}
          options={TEMPLATE_CATEGORIES.map((c) => ({ value: c, label: t(`checklists.categories.${c}`) }))}
          value={category}
          onChange={setCategory}
          className="w-52"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((c) => (
          // The whole card opens the checklist; the title stays a link for keyboard and cmd-click (feedback 2026-11-07).
          <Card
            key={c.id}
            className="hover:border-primary/40 cursor-pointer transition-colors"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('a,button')) return;
              ws.go(`/checklists/${c.id}`);
            }}
          >
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <WsLink to={`/checklists/${c.id}`}>{c.name}</WsLink>
                {c.status !== 'active' && (
                  <Badge variant="secondary">{t(`checklists.statuses.${c.status}`)}</Badge>
                )}
                {c.draftRevision !== null && <Badge variant="outline">{t('checklists.draft')}</Badge>}
              </CardTitle>
              <CardDescription>
                <span>{categoryLabel(t, c.category)}</span> ·{' '}
                <span>
                  {c.currentVersionNumber
                    ? t('checklists.versionN', { n: c.currentVersionNumber })
                    : t('checklists.notPublished')}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {c.description && <p className="text-muted-foreground text-sm">{c.description}</p>}
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs tabular-nums">
                  {t('checklists.updated')}: {formatDateTime(c.updatedAt, { locale, timeZone: ws.timeZone })}
                </p>
                {/* Read-only view of the published questions (feedback 2026-11-08). */}
                {c.currentVersionId && (
                  <Button asChild size="sm" variant="outline">
                    <WsLink to={`/checklists/${c.id}/versions/${c.currentVersionId}`}>{t('checklists.detail.open')}</WsLink>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {pages.isSuccess && rows.length === 0 && <EmptyState title={t('checklists.empty')} />}
      {pages.hasNextPage && (
        <Button
          variant="outline"
          className="mt-3"
          disabled={pages.isFetchingNextPage}
          onClick={() => void pages.fetchNextPage()}
        >
          {t('common.loadMore')}
        </Button>
      )}
      {creating && <NewChecklistDialog open onOpenChange={setCreating} />}
    </div>
  );
}
