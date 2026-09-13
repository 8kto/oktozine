/**
 * @file `{% lang X %} ... {% /lang %}` block parser.
 *
 * Keeps only the content of the block whose language tag matches the
 * document's resolved build language (`config.buildLang`, itself defaulted
 * from the `OB_LANG` env var), dropping every other language block. Blocks
 * are independent and may span multiple lines.
 *
 * @module macros/lang-block
 * @pipeline markdown+template
 *
 * Registered in both pipelines, and both registrations are required:
 * - `macros/index.ts` runs it on raw Markdown, before `mdRenderer.render()`.
 *   This must happen pre-render: once a multi-paragraph block is split into
 *   separate `<p>` tags by the renderer, replacing the (now HTML-wrapped)
 *   block by regex leaves unbalanced `<p>`/`</p>` tags behind.
 * - `build-html.ts`'s `applyTemplate` runs it again on the fully composed
 *   page, to resolve `{% lang %}` blocks written directly in `.html`
 *   template files, which never pass through the Markdown macro pipeline.
 *
 * @example Markdown input
 * ```markdown
 * {% lang en %}
 *   <span class="cover-title--subtitle">In the Eye of</span> Vargothar
 * {% /lang %}
 * {% lang ru %}
 *   Зеница Варготара
 * {% /lang %}
 * ```
 *
 * @example Output (when `config.buildLang === 'en'`)
 * ```html
 * <span class="cover-title--subtitle">In the Eye of</span> Vargothar
 * ```
 */

import type { IDocumentConfig, MacroFn } from '../types'

const DEFAULT_LANG = 'en'

const LANG_BLOCK_RE = /\{%\s*lang\s+([a-zA-Z-]+)\s*%\}([\s\S]*?)\{%\s*\/lang\s*%\}/g

/**
 * Replace every `{% lang X %} ... {% /lang %}` block with its content when
 * `X` matches the document's resolved build language, or with an empty
 * string otherwise.
 *
 * @param markdown - Source Markdown (or HTML) string.
 * @param config   - Document configuration; `config.buildLang` selects the
 *                   current language (defaults to `'en'`).
 * @returns Markdown with lang blocks resolved to the matching branch.
 */
export const parseLangBlocks: MacroFn = (markdown: string, config: IDocumentConfig) => {
  if (typeof markdown !== 'string' || !markdown) {
    return markdown
  }

  const lang = config?.buildLang ?? DEFAULT_LANG

  return markdown.replace(LANG_BLOCK_RE, (_, blockLang: string, content: string) =>
    blockLang === lang ? content.trim() : '',
  )
}
