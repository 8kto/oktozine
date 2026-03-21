import { logger } from '../lib/logger'
import type { CommandHandlerFn, IPartProperties } from '../types'

import { addAliases } from './cmd-alias'
import { convertNamedSections } from './cmd-anchors'
import { convertListToTable } from './cmd-convert-list'
import {
  glueCrystalsAlike,
  glueDamageUnits,
  glueShorthands,
  glueUnits,
  glueUnitsWithNoLineBreaks,
  glueWords,
} from './cmd-glue-units'
import { linkify } from './cmd-linkify'
import { parseConditionalMode } from './cmd-parse-conditional-mode'
import { convertRefInserts } from './cmd-ref-insert'
import { convertStatsInserts } from './cmd-stats-insert'

// Lazily initialised to break the circular-dependency TDZ in ESM:
// commands/index → cmd-ref-insert → resolve-reference-files → commands/index
let _commandHandlers: CommandHandlerFn[] | null = null

const getCommandHandlers = (): CommandHandlerFn[] => {
  if (!_commandHandlers) {
    _commandHandlers = [
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
  return _commandHandlers
}

const handleCommands = (markdown: string, config: IPartProperties): string =>
  getCommandHandlers().reduce((acc, handler) => {
    try {
      return typeof handler === 'function' ? handler(acc, config) : acc
    } catch (err) {
      logger.error(`Error in <${handler?.name}> handler`)
      logger.error(err)

      return acc
    }
  }, markdown)

export default handleCommands
