import { formatDateTime } from '@edildy/i18n';
import { useCallback } from 'react';
import { useMe } from './session';
import { useLocale } from '@/lib/i18n';

/** "Aynur Q." from "Aynur Quliyeva" (feedback 2026-11-14): first name, then the surname's initial; one word stays as is. */
export function shortName(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const last = rest[rest.length - 1];
  if (!first) return '';
  return last ? `${first} ${last.charAt(0).toLocaleUpperCase('az')}.` : first;
}

export function useFormatDateTime(): (iso: string) => string {
  const { tenant } = useMe();
  const locale = useLocale();
  return useCallback((iso: string) => formatDateTime(iso, { locale: locale, timeZone: tenant.timezone }), [locale, tenant.timezone]);
}
