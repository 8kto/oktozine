/**
 * @file Macros for turning custom anchored sections into HTML (ugly) layout
 * @example ```markdown
 *    `<!-- named[%NAME%] /-->`
 * ```
 */

/**
 * @type {CommandHandlerFn}
 * @param {string} markdown
 * @returns {string}
 */
export const convertNamedSections = (markdown) => {
  const commandPattern = /<!-- named\[(.*?)] \/-->/g
  if (!commandPattern.test(markdown)) {
    return markdown
  }

  return markdown.replace(commandPattern, (match, name) => {
    return !name ? match : `<a id="${name}" class="hidden"></a>`
  })
}
