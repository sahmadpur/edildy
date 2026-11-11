import type { PermissionKey } from '@taskop/contracts';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Building2, ChartColumn, ChevronDown, ClipboardCheck, ClipboardList, Clock, Home, ListChecks, LogOut, type LucideIcon, Megaphone, Menu, Settings, ShieldCheck, TriangleAlert, Users, X } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageMenu } from '@/components/language-menu';
import { Mark } from '@/components/logo';
import { Button, buttonVariants } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { session } from '@/lib/session';
import { cn } from '@/lib/utils';
import { UserMenu } from './user-menu';
import { VerifyEmailBanner } from './verify-email-banner';

export interface NavItem {
  to: '/' | '/users' | '/sites' | '/teams' | '/audit' | '/settings' | '/checklists' | '/assignments' | '/problems' | '/tasks' | '/audits' | '/reports' | '/roster';
  /** When the user may not open `to`, the first of these they may open is linked instead (a merged page's other tab). */
  fallbacks?: readonly { to: NavItem['to']; permission: PermissionKey }[];
  labelKey: string;
  icon: LucideIcon;
  /** One key, or a list of which any one suffices. */
  permission?: PermissionKey | readonly PermissionKey[];
  /** The sidebar group (nav.groups.*). */
  group: 'overview' | 'operations' | 'admin' | 'other';
  /** Other pages this item stands for: a merged page's second tab (e.g. /calendar under Yoxlamalar). */
  also?: readonly string[];
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: Home, group: 'overview' },
  { to: '/problems', labelKey: 'nav.problems', icon: TriangleAlert, permission: 'assignments.view', group: 'overview' },
  { to: '/reports', labelKey: 'nav.reports', icon: ChartColumn, permission: 'reports.view', group: 'overview' },
  {
    to: '/assignments',
    labelKey: 'nav.assignments',
    icon: ListChecks,
    permission: ['assignments.view', 'checklists.view'],
    fallbacks: [{ to: '/checklists', permission: 'checklists.view' }],
    group: 'operations',
    also: ['/calendar', '/checklists', '/templates'],
  },
  { to: '/tasks', labelKey: 'nav.tasks', icon: ClipboardCheck, permission: ['tasks.view', 'tasks.manage'], group: 'operations' },
  { to: '/audits', labelKey: 'nav.audits', icon: ShieldCheck, permission: 'audits.perform', group: 'other' },
  // Əməkdaş siyahısı and Komandalar are the tabs of one page (feedback 2026-11-11, item 15).
  {
    to: '/users',
    labelKey: 'nav.users',
    icon: Users,
    permission: ['users.view', 'teams.view'],
    fallbacks: [{ to: '/teams', permission: 'teams.view' }],
    group: 'admin',
    also: ['/teams'],
  },
  { to: '/sites', labelKey: 'nav.sites', icon: Building2, permission: 'sites.view', group: 'admin' },
  // Növbə cədvəli is the first tab (feedback 2026-11-11, item 11).
  { to: '/roster', labelKey: 'nav.shifts', icon: Clock, permission: 'shifts.view', group: 'admin', also: ['/shifts'] },
  { to: '/audit', labelKey: 'nav.audit', icon: ClipboardList, permission: 'audit.view', group: 'admin' },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, group: 'admin' },
];

const GROUPS: NavItem['group'][] = ['overview', 'operations', 'admin', 'other'];

/** The home item matches only its own path; every other item also owns its sub-pages and `also` aliases. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.to === '/') return pathname === '/';
  return [item.to, ...(item.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Which groups the user folded, kept across visits. */
const COLLAPSED_KEY = 'taskop.nav.collapsed';
function readCollapsed(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((g): g is string => typeof g === 'string') : []);
  } catch {
    return new Set();
  }
}

export function AppShell() {
  const { t } = useTranslation();
  const s = useSyncExternalStore(session.subscribe, session.get);
  const navigate = useNavigate();
  const href = useRouterState({ select: (r) => r.location.href });
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  // The group of the current page is shown open on arrival whatever was folded; it folds only when its heading is
  // clicked on this very page, so the heading always does what it shows. Forgotten on every page change.
  const [folded, setFolded] = useState<{ group: string; at: string } | null>(null);
  const activeFolded = folded?.at === pathname ? folded.group : null;
  const setGroupOpen = (group: string, open: boolean) => {
    setFolded(open ? null : { group, at: pathname });
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (open) next.delete(group);
      else next.add(group);
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        // Private mode or a full store: the fold still works for this visit.
      }
      return next;
    });
  };

  // Remember the last location seen while signed in, so the redirect target is the page the user was on
  // (not /login itself, which would loop).
  const lastHref = useRef(href);
  useEffect(() => {
    if (s.status === 'authenticated') lastHref.current = href;
  }, [s.status, href]);

  useEffect(() => {
    if (s.status === 'anonymous') void navigate({ to: '/login', search: { redirect: lastHref.current } });
  }, [s.status, navigate]);

  // The drawer closes on navigation and on Escape.
  const [openedAt, setOpenedAt] = useState(href);
  const drawerOpen = open && openedAt === href;
  const openDrawer = () => {
    setOpenedAt(href);
    setOpen(true);
  };
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  if (s.status !== 'authenticated') return null;
  const { me } = s;
  const allowed = (p: NavItem['permission']) => !p || (typeof p === 'string' ? [p] : p).some((k) => me.permissions.includes(k));
  // A merged page links to its first tab the user may open: /assignments, or /checklists without assignments.view.
  const target = (item: NavItem): NavItem['to'] => {
    const primary = typeof item.permission === 'string' ? item.permission : item.permission?.[0];
    if (!item.fallbacks || !primary || me.permissions.includes(primary)) return item.to;
    return item.fallbacks.find((f) => me.permissions.includes(f.permission))?.to ?? item.to;
  };
  const items = NAV_ITEMS.filter((i) => allowed(i.permission));
  const groups = GROUPS.map((g) => [g, items.filter((i) => i.group === g)] as const).filter(([, list]) => list.length > 0);
  const activeGroup = items.find((i) => isNavItemActive(i, pathname))?.group;
  const isOpen = (group: string) => (group === activeGroup ? activeFolded !== group : !collapsed.has(group));

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        {t('common.skipToContent')}
      </a>
      {drawerOpen && <div aria-hidden className="bg-deep/50 fixed inset-0 z-30 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={cn(
          'bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label={t('common.menu')}
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <Mark className="size-8 text-white" />
          <div className="min-w-0">
            <div className="text-base leading-tight font-semibold tracking-[-0.02em]">Taskop</div>
            <div className="text-on-deep-muted truncate text-xs">{me.tenant.name}</div>
          </div>
          <Button variant="ghost" size="icon" className="text-on-deep ml-auto hover:bg-white/10 hover:text-white lg:hidden" aria-label={t('common.closeMenu')} onClick={() => setOpen(false)}>
            <X />
          </Button>
        </div>
        <nav aria-label={t('common.menu')} className="flex-1 overflow-y-auto px-3 pb-4">
          {groups.map(([group, list]) => (
            <Collapsible key={group} open={isOpen(group)} onOpenChange={(open) => setGroupOpen(group, open)} className="mt-3 first:mt-0">
              <CollapsibleTrigger className="text-on-deep-muted flex w-full items-center justify-between rounded-md px-3 pb-1 text-[11px] font-medium hover:text-white focus-visible:outline-saffron [&[data-state=open]>svg]:rotate-180">
                {t(`nav.groups.${group}`)}
                <ChevronDown className="size-3 transition-transform" aria-hidden />
              </CollapsibleTrigger>
              <CollapsibleContent className="grid gap-0.5">
                {list.map((item) => {
                  const active = isNavItemActive(item, pathname);
                  return (
                    <Link
                      key={item.to}
                      to={target(item) as '/'}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'text-on-deep-muted relative flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-white/8 hover:text-white focus-visible:outline-saffron',
                        active && 'bg-white/10 text-white font-medium before:absolute before:inset-y-1.5 before:left-0 before:w-0.75 before:rounded-r before:bg-saffron',
                      )}
                    >
                      <item.icon className="size-4" aria-hidden />
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('common.menu')} aria-expanded={drawerOpen} onClick={openDrawer}>
            <Menu />
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <LanguageMenu compact />
            {allowed('notifications.send') && (
              <Link to="/messages" aria-label={t('nav.messages')} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                <Megaphone className="size-4" aria-hidden />
              </Link>
            )}
            <NotificationBell />
            <UserMenu me={me} />
            <Button variant="ghost" size="icon" aria-label={t('nav.logout')} onClick={() => void session.signOut()}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <VerifyEmailBanner />
        <main id="main" className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
