/**
 * @file Macros for turning custom anchored sections into HTML layout
 * @example `<!-- named[%NAME%] /-->`
 */

import type { CommandHandlerFn } from '../types'

export const convertNamedSections: CommandHandlerFn = (markdown) => {
  const commandPattern = /<!-- named\[(.*?)] \/-->/g
  if (!commandPattern.test(markdown)) {
    return markdown
  }

  return markdown.replace(commandPattern, (match, name: string) => {
    return !name ? match : `<a id="${name}" class="hidden"></a>`
  })
}
