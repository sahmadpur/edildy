import { useTranslation } from 'react-i18next';
import { PageTabs } from '@/components/page-tabs';
import { useWorkspace, wsClick } from './workspace';

/** Yoxlama vərəqələri and Şablonlar are two tabs of one page; the second needs checklists.manage (platform admins have it). */
export function ChecklistTabs({ active }: { active: 'checklists' | 'templates' }) {
  const { t } = useTranslation();
  const ws = useWorkspace();
  const tab = (key: 'checklists' | 'templates', to: string, labelKey: string) => ({ key, label: t(labelKey), href: `${ws.base}${to}`, active: active === key, onClick: wsClick(ws, to) });
  return <PageTabs label={t('checklists.title')} tabs={[tab('checklists', '/checklists', 'nav.checklists'), ...(ws.can.manage ? [tab('templates', '/templates', 'nav.templates')] : [])]} />;
}
