/**
 * @file Shorthand aliases that expand HTML-comment macros and apply
 * platform-specific text substitutions before Markdown rendering.
 *
 * Two groups of replacements are applied:
 *
 * 1. **Item/stats shorthand** — `<!-- item[Name] … /-->` and
 *    `<!-- stats[Name] … /-->` are rewritten to the canonical
 *    `<!-- cmd[ref] header[Name] detailed … /-->` form so that
 *    {@link convertRefInserts} can resolve them later in the pipeline.
 *
 * 2. **HTML aliases** — layout helpers written as HTML comments are expanded
 *    into actual HTML elements (conditional blocks, column/page breaks,
 *    picture placeholders, etc.).
 *
 * For OSR builds (document id ending with `osr`), an additional text-level
 * substitution replaces ` : ` with `:\u00A0` (non-breaking colon+space).
 *
 * @module macros/alias
 * @pipeline markdown
 *
 * @example Item shorthand
 * ```markdown
 * <!-- item[Magic sword] no-page-break /-->
 * ↓ becomes ↓
 * <!-- cmd[ref] header[Magic sword] detailed  no-page-break  /-->
 * ```
 *
 * @example Conditional block
 * ```markdown
 * <!-- cmd:if[osr] margin -->
 *   OSR-only content here
 * <!-- /cmd:if -->
 * ```
 *
 * @example Layout helpers
 * ```markdown
 * <!-- page-break /-->
 * <!-- col-break /-->
 * <!-- col-stop /-->
 * <!-- span-all-columns /-->
 * <!-- pic[landscape] id[volcano-img] /-->
 * ```
 */

import type { IDocumentConfig, MacroFn } from '../types'

/** Matches `<!-- item[…] … /-->` and `<!-- stats[…] … /-->`. */
const ALIASES = /<!-- (?:item|stats)\[([^\]]+)]([^/]*)\/-->/g

/**
 * Static HTML-comment → HTML-element replacement pairs.
 *
 * Each entry is `[pattern, replacement]`. String patterns use exact match
 * via `replaceAll`; RegExp patterns use global replacement.
 *
 * | Comment syntax | Produced HTML |
 * |---|---|
 * | `<!-- cmd:if[mode] margin -->` | `<div class="conditional-block conditional-block--with-margin conditional-block--mode">` |
 * | `<!-- cmd:if[mode] -->` | `<div class="conditional-block conditional-block--mode">` |
 * | `<!-- /cmd:if -->` | `</div>` |
 * | `<!-- col-break /-->` | Column break div |
 * | `<!-- col-stop /-->` | Column stop div |
 * | `<!-- page-break /-->` | Page break div |
 * | `<!-- span-all-columns /-->` | Span-all-columns spacer div |
 * | `<!-- pic[type] id[elemId] /-->` | `<div id="elemId" class="pic-type"></div>` |
 */
const HTML_ALIASES: Array<[string | RegExp, string]> = [
  [
    /<!--\s*cmd:if\[(.*?)\]\s+margin\s+-->/g,
    `<div class="conditional-block conditional-block--with-margin conditional-block--$1">`,
  ],
  [/<!--\s*cmd:if\[(.*?)\]\s*-->/g, `<div class="conditional-block conditional-block--$1">`],
  [`<!-- /cmd:if -->`, `</div>`],
  [`<!-- col-break /-->`, `<div class="col-break" aria-hidden="true" role="none">&nbsp;</div>`],
  [`<!-- col-stop /-->`, `<div class="col-stop" aria-hidden="true" role="none">&nbsp;</div>`],
  [`<!-- page-break /-->`, `<div class="page-break" />`],
  [`<!-- span-all-columns /-->`, `<div class="span-all-columns">&nbsp;</div>`],
  [/<!--\s*pic\[(.*?)\]\s+id\[(.*?)\]\s*\/-->/g, `<div id="$2" class="pic-$1"></div>`],
]

/**
 * Expand shorthand aliases and HTML-comment macros, then apply any extra
 * `config.aliases` pairs. OSR-specific aliases are supplied by the OSR
 * document config, so no project-specific detection is needed here.
 *
 * @returns Markdown with all aliases expanded.
 */
export const addAliases: MacroFn = (markdown: string, config: IDocumentConfig) => {
  const replaced = markdown.replace(ALIASES, '<!-- cmd[ref] header[$1] detailed $2 /-->')

  const res = HTML_ALIASES.reduce((acc, cur) => acc.replaceAll(cur[0], cur[1]), replaced)

  return (config.aliases ?? []).reduce((acc, [pattern, replacement]) => acc.replaceAll(pattern, replacement), res)
}
