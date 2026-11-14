import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A page's "Yeni …" buttons sit on the line of its tabs, not on the title's (feedback 2026-11-14): the tabs on the
 * left, the buttons on the right in a track of the same height and shape as the tab strip.
 */
export function TabRow({ children, actions, className }: { children?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center justify-between gap-3 [&>nav]:mb-0', className)}>
      {children ?? <span />}
      {actions && <TabActions>{actions}</TabActions>}
    </div>
  );
}

/** The track around page actions: the tab strip's recess, so its keys line up with the tabs. */
export function TabActions({ children }: { children: ReactNode }) {
  return <div className="tp-tabs-list inline-flex items-center">{children}</div>;
}

/** A key in a TabActions track: a tab's height and corners; primary (the default) or a plain raised key. */
export const tabActionClass = (variant: 'primary' | 'secondary' = 'primary') =>
  cn(
    'tp-tab-action inline-flex shrink-0 items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
    variant === 'secondary' && 'tp-tab-action-secondary',
  );
