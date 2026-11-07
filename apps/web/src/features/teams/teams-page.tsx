import type { TeamDto } from '@taskop/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Power, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/states';
import { errorText } from '@/lib/errors';
import { api, useCan } from '@/lib/session';
import { useActiveUsers, useTeams } from './queries';
import { TeamDialog } from './team-dialog';

export function TeamsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const canManage = useCan('teams.manage');
  const canSeeUsers = useCan('users.view');
  const teams = useTeams();
  const users = useActiveUsers(canSeeUsers);
  const [editing, setEditing] = useState<TeamDto | 'new' | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['teams'] });

  return (
    <div>
      <PageHeader
        title={t('teams.title')}
        actions={canManage && <Button onClick={() => setEditing('new')}>{t('teams.add')}</Button>}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(teams.data ?? []).map((team) => {
          const toggleLabel = team.active ? t('common.deactivate') : t('common.reactivate');
          return (
            <Card key={team.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {team.name}
                  <Badge variant={team.active ? 'default' : 'secondary'}>
                    {team.active ? t('common.active') : t('common.inactive')}
                  </Badge>
                </CardTitle>
                <CardDescription>{t('teams.membersCount', { count: team.memberIds.length })}</CardDescription>
                {canManage && (
                  <CardAction className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={t('common.edit')}
                      title={t('common.edit')}
                      onClick={() => setEditing(team)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={toggleLabel}
                      title={toggleLabel}
                      onClick={async () => {
                        try {
                          await api.teams.update(team.id, { active: !team.active });
                          await refresh();
                        } catch (e) {
                          toast.error(errorText(t, e));
                        }
                      }}
                    >
                      {team.active ? <Power className="size-4" /> : <RotateCcw className="size-4" />}
                    </Button>
                  </CardAction>
                )}
              </CardHeader>
              {team.description && (
                <CardContent>
                  <p className="text-muted-foreground text-sm">{team.description}</p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
      {teams.data?.length === 0 && <EmptyState title={t('teams.empty')} />}
      {editing && (
        <TeamDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          team={editing === 'new' ? undefined : editing}
          users={users.data ?? []}
          canEditMembers={canSeeUsers}
          onSubmit={async (v) => {
            const description = v.description || null;
            try {
              let team: TeamDto;
              if (editing === 'new') {
                team = await api.teams.create({ name: v.name, description });
                // Switch to edit mode so a retry after a partial failure updates instead of duplicating.
                setEditing(team);
              } else {
                team = await api.teams.update(editing.id, { name: v.name, description });
              }
              if (canSeeUsers) {
                const current = new Set(team.memberIds);
                const changed =
                  v.memberIds.length !== current.size || v.memberIds.some((id) => !current.has(id));
                if (changed) await api.teams.setMembers(team.id, v.memberIds);
              }
            } finally {
              await refresh();
            }
          }}
        />
      )}
    </div>
  );
}
