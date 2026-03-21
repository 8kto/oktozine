/**
 * Inline conditional blocks parser with alias fallback.
 * Supports: `{{ main: Main content | osr: OSR content }}`
 */

import type { CommandHandlerFn, IPartProperties } from '../types'

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

export const parseConditionalMode: CommandHandlerFn = (markdown, config) => {
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
