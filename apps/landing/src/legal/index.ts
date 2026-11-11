import type { Language } from '@edildy/i18n';
import az from './az';
import en from './en';
import ru from './ru';
import type { LegalTexts } from './types';

export type { LegalBlock, LegalDocument, LegalSection, LegalTexts } from './types';

export const LEGAL: Readonly<Record<Language, LegalTexts>> = { az, en, ru };

const EMAIL = /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/;

/** Splits text around e-mail addresses so the page can render each address as a mailto link. */
export const linkEmails = (text: string): { text: string; email: boolean }[] =>
  text
    .split(EMAIL)
    .map((part, i) => ({ text: part, email: i % 2 === 1 }))
    .filter((part) => part.text !== '');
