import type { MouseEvent } from 'react';
import { tabsListVariants, tabsTriggerClassName } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface PageTab {
  key: string;
  label: string;
  href: string;
  active: boolean;
  /** Client-side navigation for a plain click; the href keeps cmd/ctrl-click and the context menu working. */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

/** True for a left click without modifiers: the one the app handles itself instead of letting the browser follow the href. */
export const isPlainClick = (e: MouseEvent<HTMLAnchorElement>): boolean => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);

/**
 * A line of tabs whose tabs are links: each tab is its own page with its own URL, so deep links keep working and no
 * redirect is needed. Styled like the line variant of the Tabs component.
 */
export function PageTabs({ tabs, label, className }: { tabs: readonly PageTab[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} data-orientation="horizontal" className={cn('group/tabs mb-4 flex data-horizontal:flex-col', className)}>
      <div data-variant="line" className={tabsListVariants({ variant: 'line' })}>
        {tabs.map((tab) => (
          <a key={tab.key} href={tab.href} onClick={tab.onClick} aria-current={tab.active ? 'page' : undefined} data-active={tab.active ? '' : undefined} className={tabsTriggerClassName}>
            {tab.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
