import { az } from '@edildy/i18n';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/page-header';

/** The questions in the order the page shows them; the texts live in the `faq` namespace of each language. */
const QUESTIONS = Object.keys(az.faq.items) as (keyof typeof az.faq.items)[];

/** Tez-tez verilən suallar (feedback 2026-11-14): one question per row, the answer opens under it. */
export function FaqPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t('faq.title')} description={t('faq.intro')} />
      <div className="bg-card divide-y rounded-xl border">
        {QUESTIONS.map((key) => (
          <details key={key} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
              {t(`faq.items.${key}.q`)}
              <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">{t(`faq.items.${key}.a`)}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
