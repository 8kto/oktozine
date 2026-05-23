/**
 * @file Inline conditional blocks parser with alias fallback.
 *
 * Replaces fenced conditional expressions with the branch that matches the
 * current document's `id`. When no direct match is found, the document's
 * `conditionalsAlias` mapping is consulted as a fallback.
 *
 * @module macros/parse-conditional-mode
 *
 * @example Markdown input
 * ```markdown
 * `{{ main: Main version text | osr: OSR version text }}`
 * ```
 *
 * @example Output (when `config.id === 'main'`)
 * ```html
 * <span class="conditional-block conditional-block--main">Main version text</span>
 * ```
 *
 * @example Alias fallback (`config.id === 'bestiary-osr'`, `conditionalsAlias: { 'bestiary-osr': 'bestiary' }`)
 * ```markdown
 * `{{ bestiary: Bestiary text }}`
 * <!-- resolves via alias because 'bestiary-osr' maps to 'bestiary' -->
 * ```
 */

import type { IDocumentConfig, MacroFn } from '../types'

/**
 * Extract the text for a given branch from the raw conditional content.
 *
 * @param blockContent - The raw content between `{{ }}`, pipe-separated branches.
 * @param mode         - The branch id to look for (e.g. `"main"`, `"osr"`).
 * @returns The matched branch text, or `""` if no branch matches.
 */
const getContent = (blockContent: string, mode: string): string => {
  if (typeof blockContent !== 'string' || typeof mode !== 'string' || !mode.trim()) {
    return ''
  }

  const branchRe = new RegExp(`^\\s*${mode}\\s*:\\s*([\\s\\S]*?)\\s*$`)

  for (const rawBranch of blockContent.split('|')) {
    const branch = rawBranch.trim()
    if (!branch) {
      continue
    }

    const match = branch.match(branchRe)
    if (match) {
      return (match[1] ?? '').trim()
    }
  }

  return ''
}

/**
 * Replace every `` `{{ ... }}` `` conditional block with the branch matching
 * `config.id`, falling back to `config.conditionalsAlias` when needed.
 *
 * @param markdown - Source Markdown string.
 * @param config   - Document configuration; uses `config.id` for branch matching
 *                   and `config.conditionalsAlias` for fallback resolution.
 * @returns Markdown with conditionals resolved to plain text wrapped in
 *          `<span class="conditional-block conditional-block--<id>">`.
 */
export const parseConditionalMode: MacroFn = (markdown: string, config: IDocumentConfig) => {
  if (typeof markdown !== 'string' || !markdown) {
    return markdown
  }

  const id = config?.id
  if (typeof id !== 'string' || !id.trim()) {
    return markdown
  }

  const idTrimmed = id.trim()

  const MODE_RE = /^[A-Za-z0-9_-]+$/
  if (!MODE_RE.test(idTrimmed)) {
    throw new Error(`Invalid id: ${JSON.stringify(id)}`)
  }

  const conditionalsAlias = config?.conditionalsAlias || {}

  const commandPattern = /`{{([\s\S]*?)}}`/g

  if (!commandPattern.exec(markdown)) {
    return markdown
  }
  commandPattern.lastIndex = 0

  return markdown.replace(commandPattern, (match, content: string) => {
    let resolvedMode = idTrimmed
    let txt = getContent(content, resolvedMode)

    if (!txt) {
      const alias = conditionalsAlias[idTrimmed]
      if (alias) {
        resolvedMode = alias
        txt = getContent(content, resolvedMode)
      }
    }

    if (!txt) {
      return ''
    }

    return `<span class="conditional-block conditional-block--${resolvedMode}">${txt}</span>`
  })
}
