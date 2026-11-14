import { type ChecklistContent, countItems, hasRules, ITEM_TYPES, type Item, type ItemType } from '@edildy/contracts';
import { Copy, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmButton } from '@/components/confirm-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { IssueIndex } from './issues';
import type { BuilderAction } from './reducer';
import { findItem, type NodeRef, rootItemId } from './tree';

export function AddItemButton({ onAdd, disabled, label }: { onAdd: (type: ItemType) => void; disabled?: boolean; label?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-1">
      <Button type="button" variant="ghost" size="sm" className="justify-start text-xs" disabled={disabled} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        + {label ?? t('checklists.builder.addItem')}
      </Button>
      {open && (
        <div className="flex flex-wrap gap-1 rounded-md border p-2">
          {ITEM_TYPES.map((type) => (
            <Button
              key={type}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setOpen(false);
                onAdd(type);
              }}
            >
              {t(`checklists.itemTypes.${type}`)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  content: ChecklistContent;
  selected: NodeRef;
  issues: IssueIndex;
  dispatch: (a: BuilderAction) => void;
  readOnly: boolean;
}

/** "Birinci bölmənin adı", "İkinci …": ordinal words up to ten, then "11. bölmənin adı". */
function sectionTitleLabel(t: (k: string, o?: Record<string, unknown>) => string, index: number) {
  const n = index + 1;
  return n <= 10 ? t('checklists.builder.sectionTitleNth', { nth: t(`checklists.builder.ordinals.n${n}`) }) : t('checklists.builder.sectionTitleN', { n });
}

export function Canvas({ content, selected, issues, dispatch, readOnly }: Props) {
  const { t } = useTranslation();
  // The section whose (still empty) guidance box the user opened with "+".
  const [guidanceOpenFor, setGuidanceOpenFor] = useState<string | null>(null);
  const sectionId = selected.kind === 'section' ? selected.id : selected.kind === 'item' ? findItem(content, selected.id)?.sectionId : undefined;
  const section = content.sections.find((s) => s.id === sectionId) ?? content.sections[0];
  if (!section) return <div className="text-muted-foreground rounded-md border p-6">{t('checklists.issues.noSections')}</div>;
  const root = selected.kind === 'item' ? rootItemId(content, selected.id) : null;
  const container = { kind: 'section', sectionId: section.id } as const;
  const sectionIssues = issues.byNode.get(section.id) ?? [];
  const showGuidance = section.instructions !== null || guidanceOpenFor === section.id;

  return (
    <section aria-label={section.title || t('checklists.builder.untitledSection')} className="min-h-0 overflow-y-auto rounded-md border p-4">
      <div className="grid gap-2">
        <Label htmlFor="section-title">{sectionTitleLabel(t, content.sections.indexOf(section))}</Label>
        <Input
          id="section-title"
          value={section.title}
          maxLength={200}
          disabled={readOnly}
          aria-invalid={sectionIssues.some((i) => i.field === 'title')}
          onChange={(e) => dispatch({ type: 'updateSection', sectionId: section.id, patch: { title: e.target.value } })}
        />
        {showGuidance ? (
          <GuidanceField
            value={section.instructions ?? ''}
            readOnly={readOnly}
            focus={guidanceOpenFor === section.id}
            onChange={(v) => dispatch({ type: 'updateSection', sectionId: section.id, patch: { instructions: v || null } })}
            onRemove={() => {
              setGuidanceOpenFor(null);
              dispatch({ type: 'updateSection', sectionId: section.id, patch: { instructions: null } });
            }}
          />
        ) : (
          !readOnly && (
            <div>
              <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setGuidanceOpenFor(section.id)}>
                <Plus className="size-3.5" /> {t('checklists.builder.sectionInstructions')}
              </Button>
            </div>
          )
        )}
        {sectionIssues.map((i) => (
          <p key={i.code} className="text-destructive text-sm">
            {t(i.code)}
          </p>
        ))}
        {!readOnly && (
          <div>
            <ConfirmButton
              size="sm"
              variant="ghost"
              label={t('checklists.builder.deleteSection')}
              title={t('checklists.builder.deleteSection')}
              description={t('checklists.builder.confirmDeleteSection', { count: countItems({ sections: [section] }) })}
              onConfirm={() => dispatch({ type: 'removeSection', sectionId: section.id })}
            />
          </div>
        )}
      </div>
      <ol className="mt-4 grid gap-2">
        {!readOnly && <AddItemButton onAdd={(type) => dispatch({ type: 'addItem', container, index: 0, itemType: type })} />}
        {section.items.map((item, index) => (
          <li key={item.id} className="grid gap-2">
            <ItemCard
              item={item}
              selected={selected.kind === 'item' && selected.id === item.id}
              containsSelection={root === item.id}
              issueCodes={(issues.byNode.get(item.id) ?? []).map((i) => i.code)}
              dispatch={dispatch}
              readOnly={readOnly}
            />
            {!readOnly && <AddItemButton onAdd={(type) => dispatch({ type: 'addItem', container, index: index + 1, itemType: type })} />}
          </li>
        ))}
      </ol>
    </section>
  );
}

function GuidanceField(props: {
  value: string;
  readOnly: boolean;
  focus: boolean;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const own = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (props.focus) own.current?.focus();
  }, [props.focus]);
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="section-instructions">{t('checklists.builder.sectionInstructions')}</Label>
        {!props.readOnly && (
          <Button type="button" variant="ghost" size="icon" className="ml-auto size-7" aria-label={t('checklists.builder.removeSectionInstructions')} onClick={props.onRemove}>
            <X className="size-3.5" />
          </Button>
        )}
      </div>
      <Textarea id="section-instructions" ref={own} value={props.value} maxLength={2000} disabled={props.readOnly} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  );
}

function ItemCard(props: { item: Item; selected: boolean; containsSelection: boolean; issueCodes: string[]; dispatch: (a: BuilderAction) => void; readOnly: boolean }) {
  const { t } = useTranslation();
  const { item, dispatch } = props;
  const followUps = hasRules(item) ? item.rules.reduce((n, r) => n + r.then.followUps.length, 0) : 0;
  return (
    <div
      className={cn('grid gap-2 rounded-md border p-3', props.selected && 'ring-primary ring-2', props.containsSelection && !props.selected && 'border-primary')}
      onClick={() => dispatch({ type: 'select', node: { kind: 'item', id: item.id } })}
      onFocus={() => !props.selected && dispatch({ type: 'select', node: { kind: 'item', id: item.id } })}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{t(`checklists.itemTypes.${item.type}`)}</Badge>
        {item.required && <Badge variant="outline">{t('checklists.builder.item.required')}</Badge>}
        {hasRules(item) && item.rules.length > 0 && <Badge variant="outline">{t('checklists.builder.rules.title')}: {item.rules.length}</Badge>}
        {followUps > 0 && <Badge variant="outline">{t('checklists.builder.rules.followUps')}: {followUps}</Badge>}
        {!props.readOnly && (
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="icon" className="size-7" aria-label={t('checklists.builder.duplicate')} onClick={(e) => (e.stopPropagation(), dispatch({ type: 'duplicateItem', itemId: item.id }))}>
              <Copy className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" aria-label={t('checklists.builder.delete')} onClick={(e) => (e.stopPropagation(), dispatch({ type: 'removeItem', itemId: item.id }))}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
      {/* The question itself is written in Detallar; the card only shows it and selects it. */}
      <button type="button" className={cn('text-left text-sm', !item.label.trim() && 'text-muted-foreground italic')} aria-invalid={props.issueCodes.length > 0}>
        {item.label.trim() || t('checklists.builder.noLabel')}
      </button>
      {props.issueCodes.map((code) => (
        <p key={code} className="text-destructive text-xs">
          {t(code)}
        </p>
      ))}
    </div>
  );
}
