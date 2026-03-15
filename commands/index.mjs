import { addAliases } from './cmd-alias.mjs'
import { convertNamedSections } from './cmd-anchors.mjs'
import { convertListToTable } from './cmd-convert-list.mjs'
import {
  glueCrystalsAlike,
  glueDamageUnits,
  glueShorthands,
  glueUnits,
  glueUnitsWithNoLineBreaks,
  glueWords,
} from './cmd-glue-units.mjs'
import { linkify } from './cmd-linkify.mjs'
import { parseConditionalMode } from './cmd-parse-conditional-mode.mjs'
import { convertRefInserts } from './cmd-ref-insert.mjs'
import { convertStatsInserts } from './cmd-stats-insert.mjs'
import { logger } from '../lib/logger.mjs'

/**
 * @global
 * @typedef {function(string, PartProperties): string} CommandHandlerFn
 * @description A function that takes a markdown string and returns a string
 */

/**
 * @type {CommandHandlerFn[]}
 */
const commandHandlers = [
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

/**
 * @param {string} markdown
 * @param {PartProperties} config
 * @returns {string}
 */
const handleCommands = (markdown, config) =>
  commandHandlers.reduce((acc, handler) => {
    try {
      return typeof handler === 'function' ? handler(acc, config) : acc
    } catch (err) {
      logger.error(`Error in <${handler?.name}> handler`)
      logger.error(err)

      return acc
    }
  }, markdown)

export default handleCommands
