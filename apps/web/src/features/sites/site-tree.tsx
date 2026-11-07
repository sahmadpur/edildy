import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmButton } from '@/components/confirm-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SiteNode } from './tree';

interface Props {
  nodes: SiteNode[];
  typeName: (typeId: string) => string;
  canManage: boolean;
  onAddChild: (node: SiteNode) => void;
  onEdit: (node: SiteNode) => void;
  onMove: (node: SiteNode) => void;
  onToggleActive: (node: SiteNode) => Promise<void> | void;
}

/** Every site is a box; its sub-sites are smaller boxes nested inside it, so the hierarchy reads without indentation lines. */
export function SiteTree(props: Props) {
  return (
    <ul role="tree" className="grid gap-3">
      {props.nodes.map((n) => (
        <SiteTreeItem key={n.id} node={n} {...props} />
      ))}
    </ul>
  );
}

const ICON = 'size-4';

function SiteTreeItem({ node, ...props }: Props & { node: SiteNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const nested = node.depth > 0;
  const action = (label: string, onClick: () => void) => (
    <Button variant="ghost" size="xs" onClick={onClick}>
      {label}
    </Button>
  );
  return (
    <li
      role="treeitem"
      aria-label={node.name}
      aria-expanded={hasChildren ? open : undefined}
      className={cn('rounded-xl border', nested ? 'bg-muted/30 p-2.5' : 'bg-card shadow-card p-3')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="text-muted-foreground size-5 shrink-0"
          aria-label={open ? t('sites.tree.collapse') : t('sites.tree.expand')}
          disabled={!hasChildren}
          onClick={() => setOpen((o) => !o)}
        >
          {hasChildren && (open ? <ChevronDown className={ICON} /> : <ChevronRight className={ICON} />)}
        </button>
        <span className={node.active ? 'font-medium' : 'text-muted-foreground line-through'}>
          {node.name}
        </span>
        <Badge variant="outline">{props.typeName(node.typeId)}</Badge>
        {!node.active && <Badge variant="secondary">{t('common.inactive')}</Badge>}
        {props.canManage && (
          // Words, not icons (feedback 2026-11-07); the row wraps them under the name when the box is narrow.
          <div className="ml-auto flex flex-wrap justify-end gap-0.5">
            {action(t('sites.tree.addChild'), () => props.onAddChild(node))}
            {action(t('common.edit'), () => props.onEdit(node))}
            {action(t('sites.tree.move'), () => props.onMove(node))}
            {node.active ? (
              // Spec §4.1: deactivating warns; descendants are not changed automatically and the admin decides.
              <ConfirmButton
                size="xs"
                variant="ghost"
                label={t('common.deactivate')}
                title={t('common.deactivate')}
                description={t('sites.tree.confirmDeactivate', { name: node.name })}
                onConfirm={() => props.onToggleActive(node)}
              />
            ) : (
              action(t('common.reactivate'), () => props.onToggleActive(node))
            )}
          </div>
        )}
      </div>
      {hasChildren && open && (
        <ul role="group" className="mt-2.5 grid gap-2 pl-4">
          {node.children.map((c) => (
            <SiteTreeItem key={c.id} node={c} {...props} />
          ))}
        </ul>
      )}
    </li>
  );
}
