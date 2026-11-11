import type { PermissionKey } from '@taskop/contracts';
import { useNavigate } from '@tanstack/react-router';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isPlainClick, PageTabs } from '@/components/page-tabs';
import { useMe } from '@/lib/session';

export type PeopleTabPath = '/users' | '/teams';

/** The Əməkdaşlar menu item's tabs (feedback 2026-11-11, item 15); a tab shows only to those who may open it. */
export const PEOPLE_TABS: readonly { to: PeopleTabPath; labelKey: string; permission: PermissionKey }[] = [
  { to: '/users', labelKey: 'users.tabs.list', permission: 'users.view' },
  { to: '/teams', labelKey: 'users.tabs.teams', permission: 'teams.view' },
];

/** Əməkdaş siyahısı and Komandalar as the tabs of one page, like the Yoxlamalar tabs. */
export function PeopleTabs({ active }: { active: PeopleTabPath }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { permissions } = useMe();
  const go = (to: PeopleTabPath) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    void navigate({ to });
  };
  const tabs = PEOPLE_TABS.filter((tab) => permissions.includes(tab.permission)).map((tab) => ({ key: tab.to, label: t(tab.labelKey), href: tab.to, active: tab.to === active, onClick: go(tab.to) }));
  return <PageTabs label={t('users.title')} tabs={tabs} />;
}
