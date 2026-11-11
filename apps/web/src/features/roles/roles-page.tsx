import type { RoleDto } from '@edildy/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, useCan, useMe } from '@/lib/session';
import { useCatalog, useRoles, roleDisplayName } from './queries';
import { RoleEditor } from './role-editor';

/**
 * Əməkdaş rolları: the role list beside the role editor. A Parametrlər tab since feedback 2026-11-11 (item 16), so it has
 * no page header of its own; its line and the add button sit on top.
 */
export function RolesPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const me = useMe();
  const canManage = useCan('roles.manage');
  const roles = useRoles();
  const catalog = useCatalog();
  const [picked, setPicked] = useState<RoleDto | 'new' | null>(null);
  // Until the user picks one, the first role is open, so the page never starts on an empty editor.
  const selected: RoleDto | 'new' | null = picked ?? roles.data?.[0] ?? null;
  const setSelected = setPicked;
  const held = new Set(me.permissions);
  const refresh = async () => {
    const list = await qc.fetchQuery({ queryKey: ['roles'], queryFn: api.roles.list, staleTime: 0 });
    if (selected && selected !== 'new') setSelected(list.find((r) => r.id === selected.id) ?? null);
    return list;
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{t('pages.roles')}</p>
        {canManage && <Button onClick={() => setSelected('new')}>{t('roles.add')}</Button>}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardContent className="grid gap-1 p-2">
            {(roles.data ?? []).map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelected(role)}
                className={`hover:bg-muted flex items-center justify-between rounded-md px-3 py-2 text-left ${selected !== 'new' && selected?.id === role.id ? 'bg-muted' : ''}`}
              >
                <span className={role.active ? '' : 'text-muted-foreground line-through'}>
                  {roleDisplayName(t, role)}
                </span>
                <span className="flex items-center gap-2">
                  {role.systemKey && <Badge variant="outline">{t('roles.system')}</Badge>}
                  <span className="text-muted-foreground text-xs">
                    {t('roles.users', { count: role.userCount })}
                  </span>
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              {selected === 'new'
                ? t('roles.createTitle')
                : selected
                  ? roleDisplayName(t, selected)
                  : t('roles.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selected || !catalog.data ? (
              <p className="text-muted-foreground">{t('roles.select')}</p>
            ) : (
              <RoleEditor
                role={selected === 'new' ? null : selected}
                catalog={catalog.data}
                held={held}
                canManage={canManage}
                onSave={async (draft) => {
                  if (selected === 'new') {
                    const created = await api.roles.create(draft);
                    await refresh();
                    setSelected(created);
                  } else {
                    try {
                      if (!selected.systemKey && draft.name !== selected.name)
                        await api.roles.update(selected.id, { name: draft.name });
                      if (draft.dataScope !== selected.dataScope)
                        await api.roles.update(selected.id, { dataScope: draft.dataScope });
                      await api.roles.setPermissions(selected.id, draft.permissions);
                    } finally {
                      await refresh();
                    }
                  }
                  toast.success(t('common.saved'));
                }}
                onToggleActive={
                  selected !== 'new'
                    ? async () => {
                        await api.roles.update(selected.id, { active: !selected.active });
                        await refresh();
                      }
                    : undefined
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
