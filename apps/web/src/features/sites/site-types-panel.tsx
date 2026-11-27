import type { SiteTypeDto } from '@edildy/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/confirm-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorText } from '@/lib/errors';
import { api } from '@/lib/session';
import { isRootType, siteTypeLabel } from './site-types';

/**
 * Structure types as levels (feedback 2026-11-27): Filial is always level 1 and stays active; the others are moved up
 * and down with the arrows, and a new type is added as the lowest level.
 */
export function SiteTypesPanel({ types, canManage }: { types: SiteTypeDto[]; canManage: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['site-types'] });
  const onError = (e: unknown) => toast.error(errorText(t, e));
  const create = useMutation({
    mutationFn: () => api.siteTypes.create({ name }),
    onSuccess: () => {
      setName('');
      void refresh();
    },
    onError,
  });
  const sorted = [...types].sort((a, b) => a.sortOrder - b.sortOrder);
  const others = sorted.filter((ty) => !isRootType(ty));
  const reorder = useMutation({
    mutationFn: ({ id, by }: { id: string; by: -1 | 1 }) => {
      const ids = others.map((ty) => ty.id);
      const i = ids.indexOf(id);
      [ids[i], ids[i + by]] = [ids[i + by]!, ids[i]!];
      return api.siteTypes.reorder({ ids });
    },
    onSuccess: () => void refresh(),
    onError,
  });
  const toggle = useMutation({
    mutationFn: (ty: SiteTypeDto) => api.siteTypes.update(ty.id, { active: !ty.active }),
    onSuccess: () => void refresh(),
    onError,
  });
  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {sorted.map((ty) => {
          const label = siteTypeLabel(t, ty.name);
          const root = isRootType(ty);
          const i = others.indexOf(ty);
          return (
            <li key={ty.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-muted-foreground w-[4.5rem] shrink-0 text-xs tabular-nums">
                  {t('sites.types.level', { n: ty.sortOrder + 1 })}
                </span>
                <span className={ty.active ? 'truncate' : 'text-muted-foreground truncate line-through'}>
                  {label}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {root && <Badge variant="outline">{t('sites.types.root')}</Badge>}
                {!ty.active && <Badge variant="secondary">{t('common.inactive')}</Badge>}
                {canManage && !root && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={t('sites.types.moveUp', { name: label })}
                      title={t('sites.types.moveUp', { name: label })}
                      disabled={i <= 0 || reorder.isPending}
                      onClick={() => reorder.mutate({ id: ty.id, by: -1 })}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={t('sites.types.moveDown', { name: label })}
                      title={t('sites.types.moveDown', { name: label })}
                      disabled={i === others.length - 1 || reorder.isPending}
                      onClick={() => reorder.mutate({ id: ty.id, by: 1 })}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                  </>
                )}
                {canManage &&
                  !root &&
                  (ty.active ? (
                    <ConfirmButton
                      size="xs"
                      variant="ghost"
                      label={t('common.deactivate')}
                      title={t('common.deactivate')}
                      description={t('sites.types.confirmDeactivate', { name: label })}
                      onConfirm={() =>
                        toggle.mutateAsync(ty).then(
                          () => undefined,
                          () => undefined,
                        )
                      }
                    />
                  ) : (
                    <Button size="xs" variant="ghost" onClick={() => toggle.mutate(ty)}>
                      {t('common.reactivate')}
                    </Button>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>
      {canManage && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <Input
            aria-label={t('sites.types.name')}
            placeholder={t('sites.types.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" disabled={create.isPending}>
            {t('sites.types.add')}
          </Button>
        </form>
      )}
    </div>
  );
}
