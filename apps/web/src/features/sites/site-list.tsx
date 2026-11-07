import type { SiteDto } from '@taskop/contracts';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  sites: SiteDto[];
  typeName: (typeId: string) => string;
  /** Without it (no sites.manage) the rows are plain text. */
  onOpen?: (site: SiteDto) => void;
}

/** Every site in one flat, searchable list: name, type and parent; a click opens the edit dialog. */
export function SiteList({ sites, typeName, onOpen }: Props) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const byId = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);
  const rows = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('az');
    return [...sites]
      .sort((a, b) => a.name.localeCompare(b.name, 'az'))
      .filter((s) => !needle || s.name.toLocaleLowerCase('az').includes(needle));
  }, [sites, q]);
  return (
    <div className="grid gap-3">
      <Input aria-label={t('sites.list.search')} placeholder={t('sites.list.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('sites.list.empty')}</p>
      ) : (
        <ul className="grid gap-2" aria-label={t('sites.list.title')}>
          {rows.map((s) => {
            const parent = s.parentId ? byId.get(s.parentId)?.name : null;
            const body = (
              <>
                <span className="flex flex-wrap items-center gap-2">
                  <span className={s.active ? 'font-medium' : 'text-muted-foreground line-through'}>{s.name}</span>
                  <Badge variant="outline">{typeName(s.typeId)}</Badge>
                  {!s.active && <Badge variant="secondary">{t('common.inactive')}</Badge>}
                </span>
                {parent && (
                  <span className="text-muted-foreground text-xs">
                    {t('sites.list.parent')}: {parent}
                  </span>
                )}
              </>
            );
            const cls = 'grid w-full gap-0.5 rounded-md border px-3 py-2 text-left text-sm';
            return (
              <li key={s.id}>
                {onOpen ? (
                  <button type="button" className={cn(cls, 'hover:bg-muted/50 transition-colors')} onClick={() => onOpen(s)}>
                    {body}
                  </button>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
