/**
 * @file Provides aliases for commands
 */

import type { CommandHandlerFn } from '../types'

const ALIASES = /<!-- (?:item|stats)\[([^\]]+)]([^/]*)\/-->/g

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

const HTML_ALIASES_OSR: Array<[string | RegExp, string]> = [[' : ', `: `]]

export const addAliases: CommandHandlerFn = (markdown, config) => {
  const replaced = markdown.replace(ALIASES, '<!-- cmd[ref] header[$1] detailed $2 /-->')

  let res = HTML_ALIASES.reduce((acc, cur) => {
    return acc.replaceAll(cur[0], cur[1])
  }, replaced)

  // Quick optimization for OSR builds, not to scan B(S)H versions
  if (config.id.match(/osr$/)) {
    res = HTML_ALIASES_OSR.reduce((acc, cur) => {
      return acc.replaceAll(cur[0], cur[1])
    }, res)
  }

  return res
}
