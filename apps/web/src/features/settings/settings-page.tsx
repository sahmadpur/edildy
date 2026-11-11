import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationRulesTab } from '@/features/notifications/rules-tab';
import { RolesPanel } from '@/features/roles/roles-page';
import { SubscriptionTab } from '@/features/subscription/subscription-tab';
import { api, useCan, useFeature } from '@/lib/session';
import { ChangePasswordForm } from './change-password-form';
import { OrgSettingsForm } from './org-settings-form';

export const SETTINGS_TABS = ['org', 'subscription', 'notifications', 'roles'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
export const settingsSearch = (s: Record<string, unknown>): { tab?: SettingsTab } =>
  SETTINGS_TABS.includes(s.tab as SettingsTab) ? { tab: s.tab as SettingsTab } : {};

/** The tab is in the URL (`?tab=`), so /roles can land on Əməkdaş rolları and a reload keeps the tab. */
export function SettingsPage({ tab }: { tab?: SettingsTab } = {}) {
  const { t } = useTranslation();
  const canEdit = useCan('tenant.manage');
  // Spec §8: the "Bildirişlər" tab is for notifications.manage; without it there is one section and no tab bar.
  const hasNotifications = useFeature('notifications');
  const canManageNotifications = useCan('notifications.manage') && hasNotifications;
  // Əməkdaş rolları moved here from its own page (feedback 2026-11-11, item 16).
  const canSeeRoles = useCan('roles.view');
  const navigate = useNavigate();
  // Abunəlik: the plan, for the people who manage the organisation (BR-01).
  const show: Record<SettingsTab, boolean> = { org: true, subscription: canEdit, notifications: canManageNotifications, roles: canSeeRoles };
  const tabs = SETTINGS_TABS.filter((k) => show[k]);
  // The tab the user clicked, while the URL still shows the `?tab=` it was clicked on; once the URL follows (or a link
  // brings another tab), the URL wins.
  const [picked, setPicked] = useState<{ on: SettingsTab | undefined; tab: SettingsTab } | null>(null);
  const wanted = picked && picked.on === tab ? picked.tab : tab;
  const current: SettingsTab = wanted && tabs.includes(wanted) ? wanted : 'org';
  const select = (v: string) => {
    const next = v as SettingsTab;
    setPicked({ on: tab, tab: next });
    void navigate({ to: '/settings', search: next === 'org' ? {} : { tab: next }, replace: true });
  };
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: api.tenant.get });
  // The two cards sit side by side at the same size (feedback 2026-11-07). Under the tabs the "Təşkilat" tab already
  // names the organisation card, so the card drops its own title there.
  const organisation = (
    <div className="grid items-stretch gap-6 md:grid-cols-2">
      <Card>
        {tabs.length === 1 && (
          <CardHeader>
            <CardTitle>{t('settings.org.title')}</CardTitle>
          </CardHeader>
        )}
        <CardContent>{tenant.data ? <OrgSettingsForm tenant={tenant.data} canEdit={canEdit} /> : <p>{t('common.loading')}</p>}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.password.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
  return (
    <div className="grid gap-6">
      <PageHeader title={t('settings.title')} description={t('pages.settings')} />
      {tabs.length > 1 ? (
        <Tabs value={current} onValueChange={select}>
          <TabsList>
            <TabsTrigger value="org">{t('settings.org.title')}</TabsTrigger>
            {canEdit && <TabsTrigger value="subscription">{t('subscription.title')}</TabsTrigger>}
            {canManageNotifications && <TabsTrigger value="notifications">{t('notifications.title')}</TabsTrigger>}
            {canSeeRoles && <TabsTrigger value="roles">{t('roles.title')}</TabsTrigger>}
          </TabsList>
          <TabsContent value="org">{organisation}</TabsContent>
          {canEdit && (
            <TabsContent value="subscription">
              <SubscriptionTab />
            </TabsContent>
          )}
          {canManageNotifications && (
            <TabsContent value="notifications">
              <NotificationRulesTab />
            </TabsContent>
          )}
          {canSeeRoles && (
            <TabsContent value="roles">
              <RolesPanel />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        organisation
      )}
    </div>
  );
}
