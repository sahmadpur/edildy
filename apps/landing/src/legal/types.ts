/**
 * The privacy policy and terms of use as data, one module per language. They live here rather than in @edildy/i18n
 * because each language words a section in its own number of paragraphs; the section ids (the #anchors) are the same in
 * all three, and test/landing.test.ts checks that.
 */

/** A paragraph, or a bullet list. E-mail addresses in the text become mailto links when rendered. */
export type LegalBlock = string | { readonly list: readonly string[] };

export interface LegalSection {
  /** The anchor, the same in every language: /privacy/#delete works in az, en and ru. */
  readonly id: string;
  readonly title: string;
  readonly body: readonly LegalBlock[];
}

export interface LegalDocument {
  readonly intro: readonly string[];
  readonly sections: readonly LegalSection[];
}

export interface LegalTexts {
  /** The date both documents were last changed, written out in the language ("11 November 2026"). */
  readonly updatedOn: string;
  readonly privacy: LegalDocument;
  readonly terms: LegalDocument;
}
