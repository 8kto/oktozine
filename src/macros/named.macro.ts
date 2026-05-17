/**
 * @file Converts `<!-- named[id] /-->` comment macros into hidden anchor elements.
 *
 * Used to create navigation targets (jump-to anchors) in the final HTML/PDF
 * without any visible output. The anchor `id` is taken verbatim from the
 * macro argument.
 *
 * @module macros/anchors
 *
 * @example Markdown input
 * ```markdown
 * <!-- named[secret-room] /-->
 * ```
 *
 * @example HTML output
 * ```html
 * <a id="secret-room" class="hidden"></a>
 * ```
 */

import type { MacroFn } from '../types'

/**
 * Replace every `<!-- named[<id>] /-->` comment with a hidden `<a>` anchor.
 *
 * @param markdown - Source Markdown string.
 * @returns Markdown with named-section comments replaced by anchor elements.
 */
export const convertNamedSections: MacroFn = (markdown) => {
  const commandPattern = /<!-- named\[(.*?)] \/-->/g
  if (!commandPattern.test(markdown)) {
    return markdown
  }

  return markdown.replace(commandPattern, (match, name: string) => {
    return !name ? match : `<a id="${name}"></a>`
  })
}
