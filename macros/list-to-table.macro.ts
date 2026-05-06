/**
 * @file Converts fenced Markdown lists into Markdown tables.
 *
 * A list-to-table block is delimited by an opening HTML comment with the
 * command `cmd[list-to-table]` and a closing `<!-- /cmd -->`. The opening
 * comment carries header definitions and optional modifiers.
 *
 * @module macros/convert-list
 *
 * @example Basic random table
 * ```markdown
 * <!-- cmd[list-to-table] header[d4|Encounter] -->
 * - 1 | A swarm of bats
 * - 2 | Dripping ceiling
 * - 3 | Loose rubble
 * - 4 | Mushroom patch
 * <!-- /cmd -->
 * ```
 *
 * @example Output (Markdown table wrapped in a div)
 * ```html
 * <div class=" list-to-table--converted">
 * | d4 | Encounter |
 * |------|------|
 * | 1 | A swarm of bats |
 * | 2 | Dripping ceiling |
 * | 3 | Loose rubble |
 * | 4 | Mushroom patch |
 * </div>
 * ```
 *
 * @example With modifiers
 * ```markdown
 * <!-- cmd[list-to-table] header[d6|Loot] no-page-break id[loot-table] -->
 * - 1 | Nothing
 * - 2 | 1d6 gold
 * <!-- /cmd -->
 * ```
 */

/**
 * Convert fenced `<!-- cmd[list-to-table] … -->` blocks into Markdown tables.
 *
 * The opening comment supports the following arguments:
 *
 * - `header[col1|col2|...]` — pipe-separated column headers (required).
 * - `no-page-break` — adds a `no-page-break` CSS class to prevent the table
 *   from being split across pages.
 * - `id[value]` — sets an HTML `id` attribute on the wrapper `<div>`.
 *
 * Each list item is a `- left | right` row. Items that don't match the
 * pattern are silently dropped. If no items match, the original block is
 * returned unchanged.
 *
 * @param markdown - Source Markdown string.
 * @returns Markdown with list-to-table blocks replaced by table markup.
 */
export const convertListToTable = (markdown: string): string => {
  const commandPattern = /<!-- cmd\[list-to-table]\s*header\[(.*?)](.*?)-->([\s\S]*?)<!--\s*\/cmd -->/g
  const rowPattern = /^-\s*(.*?)\s*\|\s*(.*)$/

  return markdown.replace(commandPattern, (match, headerArgs: string, extraArgs: string, listContent: string) => {
    const headers = headerArgs.split('|').map((h) => h.trim())
    const shouldWrap = extraArgs.includes('no-page-break')
    const items = listContent.trim().split(/\n(?=- )/)

    const tableHeader = `| ${headers.join(' | ')} |`
    const tableDivider = `|${headers.map(() => '------').join('|')}|`

    const tableRows = items
      .map((item) => {
        const singleLine = item.replace(/\n/g, ' ')
        const m = singleLine.match(rowPattern)
        if (!m) {
          return null
        }
        const [, left, right] = m

        return `| ${left} | ${right} |`
      })
      .filter((row): row is string => row !== null)

    if (tableRows.length === 0) {
      return match
    }

    const table = `\n${tableHeader}\n${tableDivider}\n${tableRows.join('\n')}\n`
    const className = `${shouldWrap ? 'no-page-break' : ''} list-to-table--converted`
    const idMatch = /\bid\[([A-Za-z0-9_-]+?)]/.exec(extraArgs)
    const id = idMatch?.[1]
    const idAttr = id ? ` id="${id}"` : ''

    return `<div${idAttr} class="${className}">\n${table}\n</div>`
  })
}
