import { useTranslation } from 'react-i18next';
import { PageTabs } from '@/components/page-tabs';
import { WorkTabs } from '@/features/scheduling/work-tabs';
import { useWorkspace, wsClick } from './workspace';

/**
 * For tenant users the checklists and templates are two of the Yoxlamalar page's tabs (with Təyinatlar and İcra
 * cədvəli). Platform admins, working inside a tenant, get just these two; the second needs checklists.manage.
 */
export function ChecklistTabs({ active }: { active: 'checklists' | 'templates' }) {
  const { t } = useTranslation();
  const ws = useWorkspace();
  if (ws.tabs === 'work') return <WorkTabs active={`/${active}`} />;
  const tab = (key: 'checklists' | 'templates', to: string, labelKey: string) => ({ key, label: t(labelKey), href: `${ws.base}${to}`, active: active === key, onClick: wsClick(ws, to) });
  return <PageTabs label={t('checklists.title')} tabs={[tab('checklists', '/checklists', 'nav.checklists'), ...(ws.can.manage ? [tab('templates', '/templates', 'nav.templates')] : [])]} />;
}
