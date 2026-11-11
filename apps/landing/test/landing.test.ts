import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { az, en, ru } from '@edildy/i18n';
import { describe, expect, it } from 'vitest';
import Landing from '../src/components/Landing.astro';
import LegalPage from '../src/components/LegalPage.astro';
import { LEGAL, linkEmails } from '../src/legal';

const render = async (lang: 'az' | 'en' | 'ru') => {
  const container = await AstroContainer.create();
  return container.renderToString(Landing, { props: { lang } });
};

describe('landing page', () => {
  it('renders the Azerbaijani page by default with every section', async () => {
    const html = await render('az');
    expect(html).toContain('<html lang="az"');
    expect(html).toContain(`<title>${az.landing.meta.title}</title>`);
    for (const id of ['features', 'how', 'mobile', 'faq']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain(az.landing.hero.title);
    expect(html).toContain(az.landing.faq.q1.q);
  });

  it('switches language: /en/ and /ru/ render their own strings, titles and hreflang links', async () => {
    const english = await render('en');
    expect(english).toContain('<html lang="en"');
    expect(english).toContain(en.landing.hero.title);
    expect(english).toContain(`<title>${en.landing.meta.title}</title>`);
    expect(english).not.toContain(az.landing.hero.title);
    const russian = await render('ru');
    expect(russian).toContain(ru.landing.hero.title);
    for (const html of [english, russian]) {
      expect(html).toContain('hreflang="az" href="https://edildy.com/"');
      expect(html).toContain('hreflang="en" href="https://edildy.com/en/"');
      expect(html).toContain('hreflang="ru" href="https://edildy.com/ru/"');
    }
    // The switch itself: three links, the current one marked.
    expect(english).toContain('href="/ru/" hreflang="ru"');
    expect(english).toMatch(/href="\/en\/" hreflang="en"[^>]*aria-current="page"/);
  });

  it('points Login and Sign up at the platform URL from the environment', async () => {
    const html = await render('az');
    expect(html).toContain('href="https://platform.example.test/login" data-testid="login"');
    expect(html).toContain('href="https://platform.example.test/login" data-testid="hero-login"');
    // No self-registration: the second hero button writes to Edildy.
    expect(html).toContain('href="mailto:hello@edildy.com" data-testid="hero-contact"');
    expect(html).not.toContain('/signup');
  });

});

describe('legal pages', () => {
  const renderLegal = async (lang: 'az' | 'en' | 'ru', kind: 'privacy' | 'terms') => {
    const container = await AstroContainer.create();
    return container.renderToString(LegalPage, { props: { lang, kind } });
  };

  it('renders the privacy policy with every section, the date and mailto links', async () => {
    const html = await renderLegal('en', 'privacy');
    expect(html).toContain('<html lang="en"');
    expect(html).toContain(en.landing.legal.privacyTitle);
    expect(html).toContain('Last updated: 11 November 2026');
    for (const s of LEGAL.en.privacy.sections) {
      expect(html).toContain(`id="${s.id}"`);
      expect(html).toContain(`href="#${s.id}"`);
    }
    expect(html).toContain('href="mailto:sohrab.ahmadpur@gmail.com"');
    expect(html).toContain('href="mailto:hello@edildy.com"');
    expect(html).not.toContain('being written');
  });

  it('has the account deletion section the stores look for, in every language', async () => {
    for (const lang of ['az', 'en', 'ru'] as const) {
      const html = await renderLegal(lang, 'privacy');
      const section = LEGAL[lang].privacy.sections.find((s) => s.id === 'delete');
      expect(section, lang).toBeDefined();
      expect(html).toContain('id="delete"');
      expect(html).toContain(section?.title);
    }
    expect(LEGAL.en.privacy.sections.find((s) => s.id === 'delete')?.title).toBe('How to delete your account / data');
  });

  it('renders the terms in Azerbaijani by default', async () => {
    const html = await renderLegal('az', 'terms');
    expect(html).toContain('<html lang="az"');
    expect(html).toContain(az.landing.legal.termsTitle);
    expect(html).toContain('Son yenilənmə: 11 noyabr 2026');
    expect(html).toContain('Azərbaycan Respublikasının');
  });

  it('keeps the same sections, in the same order, in all three languages', () => {
    for (const kind of ['privacy', 'terms'] as const) {
      const ids = LEGAL.az[kind].sections.map((s) => s.id);
      expect(new Set(ids).size, kind).toBe(ids.length);
      expect(LEGAL.en[kind].sections.map((s) => s.id), kind).toEqual(ids);
      expect(LEGAL.ru[kind].sections.map((s) => s.id), kind).toEqual(ids);
      for (const lang of ['az', 'en', 'ru'] as const)
        for (const s of LEGAL[lang][kind].sections) expect(s.body.length, `${lang} ${kind} ${s.id}`).toBeGreaterThan(0);
    }
    // No Azerbaijani letters left in the other two languages (the name of the country is written in each language).
    expect(JSON.stringify([LEGAL.en, LEGAL.ru])).not.toMatch(/[əƏğĞışŞ]/u);
    expect(ru.landing.legal.updated).toContain('{{date}}');
  });

  it('turns e-mail addresses into separate parts without eating the punctuation', () => {
    expect(linkEmails('Write to a.b@example.com. Thanks')).toEqual([
      { text: 'Write to ', email: false },
      { text: 'a.b@example.com', email: true },
      { text: '. Thanks', email: false },
    ]);
  });
});
