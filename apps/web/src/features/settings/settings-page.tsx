import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationRulesTab } from '@/features/notifications/rules-tab';
import { api, useCan } from '@/lib/session';
import { ChangePasswordForm } from './change-password-form';
import { OrgSettingsForm } from './org-settings-form';

export function SettingsPage() {
  const { t } = useTranslation();
  const canEdit = useCan('tenant.manage');
  // Spec §8: the "Bildirişlər" tab is for notifications.manage; without it there is one section and no tab bar.
  const canManageNotifications = useCan('notifications.manage');
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: api.tenant.get });
  // The two cards sit side by side at the same size (feedback 2026-11-07). Under the tabs the "Təşkilat" tab already
  // names the organisation card, so the card drops its own title there.
  const organisation = (
    <div className="grid items-stretch gap-6 md:grid-cols-2">
      <Card>
        {!canManageNotifications && (
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
      {canManageNotifications ? (
        <Tabs defaultValue="org">
          <TabsList>
            <TabsTrigger value="org">{t('settings.org.title')}</TabsTrigger>
            <TabsTrigger value="notifications">{t('notifications.title')}</TabsTrigger>
          </TabsList>
          <TabsContent value="org">
            {organisation}
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationRulesTab />
          </TabsContent>
        </Tabs>
      ) : (
        organisation
      )}
    </div>
  );
}
