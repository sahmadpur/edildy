import type { ReactNode } from 'react';

/**
 * The page title row: the h1, an optional line under it, and the page's actions on the right. The row is at least a
 * button tall, so what follows (a tab strip, say) sits at the same height whether or not the page has actions.
 */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="grid min-h-9 content-start gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <div className="text-muted-foreground text-sm">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
