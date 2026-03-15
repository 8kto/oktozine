/**
 * Inline conditional blocks parser with alias fallback.
 *
 * Supports:
 * `{{ main: Main content | osr: OSR content }}`
 *
 * If no direct match for config.id is found in a block, tries alias mode (@see conditionalsAlias).
 */

/**
 * Extracts the content for `mode` from an inline conditional block:
 * "main: Main content | osr: OSR content"
 *
 * Strategy:
 * - Split into branches by '|'
 * - For each branch, try matching "^\s*<mode>\s*:\s*(...)\s*$" with a dynamic RegExp
 * - Return the captured content (trimmed) for the first matching branch
 *
 * Notes:
 * - This does NOT support escaped pipes (\|) in values.
 *
 * @param {string} blockContent
 * @param {string} mode
 * @returns {string}
 */
const getContent = (blockContent, mode) => {
  if (typeof blockContent !== 'string' || typeof mode !== 'string' || !mode.trim()) {
    return ''
  }

  // Anchor to the whole branch to avoid accidental substring matches
  // Capture everything after ":" (including spaces) as value.
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
 * @type {CommandHandlerFn}
 * @param {string} markdown
 * @param {PartProperties & { conditionalsAlias?: Record<string, string> }} config
 * @returns {string}
 */
export const parseConditionalMode = (markdown, config) => {
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

  // Match: `{{ ... }}`
  // Non-greedy; works across newlines using [\s\S]
  const commandPattern = /`{{([\s\S]*?)}}`/g

  // Avoid .test() with /g because it mutates lastIndex and can produce surprises.
  if (!commandPattern.exec(markdown)) {
    return markdown
  }
  commandPattern.lastIndex = 0

  return markdown.replace(commandPattern, (match, content) => {
    // 1) direct id
    let resolvedMode = idTrimmed
    let txt = getContent(content, resolvedMode)

    // 2) alias fallback (only if direct not found)
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
