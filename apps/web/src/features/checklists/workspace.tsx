import type { ChecklistsApi, TemplatesApi } from '@taskop/api-client';
import { useNavigate } from '@tanstack/react-router';
import { createContext, type MouseEvent, type ReactNode, useContext, useMemo } from 'react';
import { isPlainClick } from '@/components/page-tabs';
import { platformApi } from '@/features/platform/platform-session';
import { api, useCan, useMe } from '@/lib/session';

export interface ChecklistWorkspace {
  checklists: ChecklistsApi;
  templates: TemplatesApi;
  can: { manage: boolean; publish: boolean; templates: boolean };
  /** Route prefix: '' for tenant users, `/platform/tenants/<id>` for platform admins. */
  base: string;
  /** Where the checklist pages sit: as tabs of the tenant's Yoxlamalar page ('work'), or on their own two tabs ('own'). */
  tabs: 'work' | 'own';
  /** Query-key scope so tenant and platform caches never mix. */
  scope: string;
  timeZone: string;
  /** Navigate to a path relative to `base`. */
  go: (to: string) => void;
}

const WorkspaceContext = createContext<ChecklistWorkspace | null>(null);

export function useWorkspace(): ChecklistWorkspace {
  const ws = useContext(WorkspaceContext);
  if (!ws) throw new Error('useWorkspace() used outside a checklist workspace');
  return ws;
}

export function WorkspaceProvider({ value, children }: { value: ChecklistWorkspace; children: ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function TenantWorkspace({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const me = useMe();
  const manage = useCan('checklists.manage');
  const publish = useCan('checklists.publish');
  const templates = useCan('templates.manage');
  const value = useMemo<ChecklistWorkspace>(
    () => ({
      checklists: api.checklists,
      templates: api.templates,
      can: { manage, publish, templates },
      base: '',
      tabs: 'work',
      scope: 'tenant',
      timeZone: me.tenant.timezone,
      go: (to) => void navigate({ to: to as '/' }),
    }),
    [manage, publish, templates, me.tenant.timezone, navigate],
  );
  return <WorkspaceProvider value={value}>{children}</WorkspaceProvider>;
}

export function PlatformTenantWorkspace({ tenantId, children }: { tenantId: string; children: ReactNode }) {
  const navigate = useNavigate();
  const value = useMemo<ChecklistWorkspace>(() => {
    const base = `/platform/tenants/${tenantId}`;
    return {
      ...platformApi.inTenant(tenantId),
      can: { manage: true, publish: true, templates: true },
      base,
      tabs: 'own',
      scope: `platform:${tenantId}`,
      timeZone: 'Asia/Baku',
      go: (to) => void navigate({ to: `${base}${to}` as '/' }),
    };
  }, [tenantId, navigate]);
  return <WorkspaceProvider value={value}>{children}</WorkspaceProvider>;
}

/** The click handler of a workspace link: a plain click navigates in the app, anything else is left to the browser. */
export const wsClick = (ws: Pick<ChecklistWorkspace, 'go'>, to: string) => (e: MouseEvent<HTMLAnchorElement>) => {
  if (!isPlainClick(e)) return;
  e.preventDefault();
  ws.go(to);
};

/** An <a> that navigates inside the current workspace (keeps cmd/ctrl-click working). */
export function WsLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const ws = useWorkspace();
  return (
    <a href={`${ws.base}${to}`} onClick={wsClick(ws, to)} className={className ?? 'font-medium hover:underline'}>
      {children}
    </a>
  );
}
