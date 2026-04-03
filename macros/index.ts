/**
 * @file Macro pipeline entry point.
 *
 * Runs all registered macros sequentially on a Markdown string before it is
 * rendered to HTML. Each macro is a pure `(markdown, config) => markdown`
 * transform ({@link MacroFn}).
 *
 * The handler list is lazily initialised to break a circular-dependency TDZ
 * in ESM: `macros/index → ref-insert → resolve-reference-files → macros/index`.
 *
 * @module macros/index
 *
 * @example
 * ```ts
 * import handleMacros from './macros/index'
 *
 * const html = handleMacros(rawMarkdown, partConfig)
 * ```
 */

import { logger } from '../lib/logger'
import type { MacroFn, IPartProperties } from '../types'

import { addAliases } from './alias'
import { convertRefInserts } from './ref.macro'
import { convertNamedSections } from './named.macro'
import { convertListToTable } from './list-to-table.macro'
import { linkify } from './linkify'
import { parseConditionalMode } from './conditionals'
import { convertStatsInserts } from './stats-insert'
import {
  glueCrystalsAlike,
  glueDamageUnits,
  glueShorthands,
  glueUnits,
  glueUnitsWithNoLineBreaks,
  glueWords,
} from './glue-units'

// Lazily initialised to break the circular-dependency TDZ in ESM:
// macros/index → ref-insert → resolve-reference-files → macros/index
let _macroHandlers: MacroFn[] | null = null

const getMacroHandlers = (): MacroFn[] => {
  if (!_macroHandlers) {
    _macroHandlers = [
      parseConditionalMode,
      addAliases,
      convertNamedSections,
      glueWords,
      glueUnits,
      glueShorthands,
      glueUnitsWithNoLineBreaks,
      glueCrystalsAlike,
      glueDamageUnits,
      convertListToTable,
      convertRefInserts,
      convertStatsInserts,
      linkify,
    ]
  }
  return _macroHandlers
}

/**
 * Run every registered macro on `markdown` in pipeline order.
 *
 * If a single handler throws, the error is logged and the previous
 * accumulator value is carried forward (the pipeline does not abort).
 *
 * @param markdown - Raw Markdown source to transform.
 * @param config   - Part-level build configuration (part id, aliases, etc.).
 * @returns The fully transformed Markdown string.
 */
const handleMacros = (markdown: string, config: IPartProperties): string =>
  getMacroHandlers().reduce((acc, handler) => {
    try {
      return typeof handler === 'function' ? handler(acc, config) : acc
    } catch (err) {
      logger.error(`Error in <${handler?.name}> handler`)
      logger.error(err)

      return acc
    }
  }, markdown)

export default handleMacros
