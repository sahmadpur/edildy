import type { PermissionKey } from '@taskop/contracts';
import { useNavigate } from '@tanstack/react-router';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isPlainClick, PageTabs } from '@/components/page-tabs';
import { useMe } from '@/lib/session';

export type WorkTabPath = '/assignments' | '/schedule' | '/checklists' | '/templates';

/** The Yoxlamalar menu item's four pages, each a tab; a tab shows only to those who may open it. */
export const WORK_TABS: readonly { to: WorkTabPath; labelKey: string; permission: PermissionKey }[] = [
  { to: '/assignments', labelKey: 'scheduling.assignments.title', permission: 'assignments.view' },
  { to: '/schedule', labelKey: 'nav.schedule', permission: 'assignments.view' },
  { to: '/checklists', labelKey: 'nav.checklists', permission: 'checklists.view' },
  { to: '/templates', labelKey: 'nav.templates', permission: 'checklists.manage' },
];

/** Təyinatlar, İcra cədvəli, Yoxlama vərəqələri and Şablonlar as the tabs of one page (the menu's "Yoxlamalar"). */
export function WorkTabs({ active }: { active: WorkTabPath }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { permissions } = useMe();
  const go = (to: WorkTabPath) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    void navigate({ to });
  };
  const tabs = WORK_TABS.filter((tab) => permissions.includes(tab.permission)).map((tab) => ({ key: tab.to, label: t(tab.labelKey), href: tab.to, active: tab.to === active, onClick: go(tab.to) }));
  return <PageTabs label={t('nav.assignments')} tabs={tabs} />;
}
