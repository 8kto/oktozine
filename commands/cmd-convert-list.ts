/**
 * @file Convert Markdown list to Markdown table
 * @example
 * <!-- cmd[list-to-table] header[d4|Table header] no-page-break -->
 * - 1 | Point 1
 * - 2 | Point 2
 */

import type { CommandHandlerFn } from '../types'

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
