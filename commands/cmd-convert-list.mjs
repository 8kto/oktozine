#!/usr/bin/env node

/**
 * @file Convert Markdown list to Markdown table
 * @param {string} header Header titles, separated by | character. List items should also use this delimiter for cells.
 * @param {boolean} no-page-break If present, wraps the table with `.no-page-break` container
 * @example ```markdown
 *    <!-- cmd[list-to-table] header[d4|Table header] no-page-break -->
 *    - 1 | Point 1
 *    - 2 | Point 2
 *    - 3 | Point 3
 *    - 4 | Point 4
 * ```
 */

/**
 * @type {CommandHandlerFn}
 * @param {string} markdown
 * @returns {string}
 */
export const convertListToTable = (markdown) => {
  // 1) Match the entire "cmd[list-to-table] ... <!-- /cmd -->" block, capturing:
  //    - headerArgs  = everything inside header[...]
  //    - extraArgs   = any flags after header[...], e.g. " no-page-break"
  //    - listContent = all lines between "-->" and "<!-- /cmd -->"
  const commandPattern = /<!-- cmd\[list-to-table]\s*header\[(.*?)](.*?)-->([\s\S]*?)<!--\s*\/cmd -->/g

  // 2) Inside the replacement callback, split listContent into separate "- X | Y" items,
  //    collapse any newline within an item into a single space, and then build table rows.
  const rowPattern = /^-\s*(.*?)\s*\|\s*(.*)$/

  return markdown.replace(commandPattern, (match, headerArgs, extraArgs, listContent) => {
    const headers = headerArgs.split('|').map((h) => h.trim())
    const shouldWrap = extraArgs.includes('no-page-break')
    const items = listContent.trim().split(/\n(?=- )/)

    const tableHeader = `| ${headers.join(' | ')} |`
    const tableDivider = `|${headers.map(() => '------').join('|')}|`

    const tableRows = items
      .map((item) => {
        // Collapse any newline(s) inside this single "- ..." into a space
        const singleLine = item.replace(/\n/g, ' ')
        const m = singleLine.match(rowPattern)
        if (!m) {
          return null
        }
        const [, left, right] = m

        return `| ${left} | ${right} |`
      })
      .filter((row) => row !== null)

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
