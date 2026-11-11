import type { SiteTypeDto } from '@edildy/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/confirm-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorText } from '@/lib/errors';
import { api } from '@/lib/session';

export function SiteTypesPanel({ types, canManage }: { types: SiteTypeDto[]; canManage: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['site-types'] });
  const onError = (e: unknown) => toast.error(errorText(t, e));
  const create = useMutation({
    mutationFn: () => api.siteTypes.create({ name, sortOrder: types.length }),
    onSuccess: () => {
      setName('');
      void refresh();
    },
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
        {types.map((ty) => (
          <li key={ty.id} className="flex items-center justify-between rounded-md border px-3 py-2">
            <span className={ty.active ? '' : 'text-muted-foreground line-through'}>{ty.name}</span>
            <div className="flex items-center gap-2">
              {!ty.active && <Badge variant="secondary">{t('common.inactive')}</Badge>}
              {canManage &&
                (ty.active ? (
                  <ConfirmButton
                    size="xs"
                    variant="ghost"
                    label={t('common.deactivate')}
                    title={t('common.deactivate')}
                    description={t('sites.types.confirmDeactivate', { name: ty.name })}
                    onConfirm={() => toggle.mutateAsync(ty).then(() => undefined, () => undefined)}
                  />
                ) : (
                  <Button size="xs" variant="ghost" onClick={() => toggle.mutate(ty)}>
                    {t('common.reactivate')}
                  </Button>
                ))}
            </div>
          </li>
        ))}
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
