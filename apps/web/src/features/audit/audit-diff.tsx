import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function diffEntries(before: unknown, after: unknown) {
  const b = asRecord(before);
  const a = asRecord(after);
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k])).map((k) => ({ key: k, before: b[k], after: a[k] }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Internal fields that mean nothing to a reader: hidden from the change list. */
const HIDDEN = new Set(['id', 'path', 'depth', 'revision']);

/** A field name in the reader's language; an unknown one is shown as is, so nothing silently disappears. */
export const fieldLabel = (t: TFunction, key: string) => t(`audit.fields.${key}`, { defaultValue: key });

/** One stored value as words: yes/no, dates in the tenant's zone, known codes by their label, ids and nested data summarised. */
export function formatAuditValue(t: TFunction, formatDateTime: (iso: string) => string, v: unknown): string {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? t('common.yes') : t('common.no');
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    if (UUID.test(v)) return `#${v.slice(-6)}`;
    if (ISO_INSTANT.test(v)) return formatDateTime(v);
    if (DAY.test(v)) return v.split('-').reverse().join('.');
    // A known code by its label: statuses and kinds, then plan add-ons and plans; anything else is data, shown as is.
    return t([`audit.values.${v}`, `subscription.features.${v}`, `subscription.plans.${v}`], { defaultValue: v });
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    if (v.every((x) => typeof x === 'string' && !UUID.test(x)) || v.every((x) => typeof x === 'number')) {
      return v.map((x) => formatAuditValue(t, formatDateTime, x)).join(', ');
    }
    return t('audit.itemCount', { count: v.length });
  }
  return t('audit.changed');
}

export function AuditDiff({ before, after, formatDateTime }: { before: unknown; after: unknown; formatDateTime: (iso: string) => string }) {
  const { t } = useTranslation();
  const rows = diffEntries(before, after).filter((r) => !HIDDEN.has(r.key));
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">{t('audit.noChanges')}</p>;
  const show = (v: unknown) => formatAuditValue(t, formatDateTime, v);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-muted-foreground text-left">
          <th className="py-1 pr-4 font-normal" />
          <th className="py-1 pr-4 font-normal">{t('audit.before')}</th>
          <th className="py-1 font-normal">{t('audit.after')}</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((r) => (
          <tr key={r.key} className="border-t align-top">
            <td className="py-1 pr-4 font-sans font-medium">{fieldLabel(t, r.key)}</td>
            <td className="py-1 pr-4 break-words text-red-700">{show(r.before)}</td>
            <td className="py-1 break-words text-green-700">{show(r.after)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
