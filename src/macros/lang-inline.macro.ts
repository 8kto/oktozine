/**
 * @file Inline `{{ locale="value" locale2="value2" }}` translation parser.
 *
 * Replaces every inline translation expression in a string with the value
 * for the current `OB_LANG` locale. Unlike `parseLangBlocks`, this targets
 * short, single-line strings and is applied to the fully composed page
 * template (after header/footer/content substitution) rather than to
 * Markdown source before rendering — it can therefore resolve translations
 * written directly in template files, not just in Markdown content.
 *
 * @module macros/lang-inline
 *
 * @example Template input
 * ```html
 * <h1>{{ en="Title" ru="Заголовок" }}</h1>
 * ```
 *
 * @example Output (`OB_LANG=ru`)
 * ```html
 * <h1>Заголовок</h1>
 * ```
 */

const INLINE_LANG_RE = /\{\{\s*((?:[a-zA-Z-]+\s*=\s*"[^"]*"\s*)+)\}\}/g

/**
 * Replace every inline `{{ locale="value" ... }}` expression in `html` with
 * the value for `process.env.OB_LANG`.
 *
 * @param html - Source HTML/template string.
 * @returns `html` with every inline translation expression resolved.
 * @throws {Error} If `OB_LANG` is not set, or has no matching translation.
 */
export const resolveInlineTranslations = (html: string): string => {
  return html.replace(INLINE_LANG_RE, (_, values: string) => {
    const translations = Object.fromEntries(
      [...values.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)].map(([, locale, value]) => [locale, value]),
    )

    const lang = process.env.OB_LANG
    if (!lang) {
      throw new Error('Language is not set')
    }

    if (!(lang in translations)) {
      throw new Error(`Missing translation for locale "${lang}"`)
    }

    return translations[lang]
  })
}
