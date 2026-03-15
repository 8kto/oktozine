#!/usr/bin/env node

/**
 * @file Insert referenced text sections from the `ModuleBuilderConfig.referenceFiles` const
 * @param {string} header ID of one of the sections in the `REFERENCES_FILEs` file (marked with `###` header)
 * @param {boolean} detailed        When set, the entire section will be inserted
 * @param {boolean} no-page-break   Disallow line breaks within the section
 * @param {boolean} alt             Enable an alternative layout for the entire block
 * @example ```markdown
 *     <!-- This command would be replaced with the `Летучая медуза` entry -->
 *     <!-- cmd[ref] header[Летучая медуза] alt no-page-break detailed id[medusa] no-header alt-header /-->
 * ```
 */

import chalk from 'chalk'

import { logger } from '../lib/logger.mjs'
import { renderReferenceBlock } from '../lib/render-reference-block.mjs'
import { getReferenceResolver } from '../lib/resolve-reference-files.mjs'

/**
 * @type {CommandHandlerFn}
 * @param {string} markdown
 * @param {ModuleBuilderConfig} buildConf
 * @returns {string}
 */
export const convertRefInserts = (markdown, buildConf) => {
  const commandPattern = /<!--\s*cmd\[ref]\s*header\[(.*?)]\s*(.*?)\/-->/gms
  if (!commandPattern.test(markdown)) {
    return markdown
  }

  const resolveContent = getReferenceResolver(buildConf)

  return markdown.replace(commandPattern, (match, title, extraArgs = '') => {
    const isFullText = extraArgs?.includes('detailed')
    const shouldWrap = !!/\sno-page-break\s/.exec(extraArgs)
    const hasAlternateLook = !!/\salt\s/.exec(extraArgs)
    const hasNoHeader = !!/\sno-header\s/.exec(extraArgs)
    const hasAlernateHeader = !!/\salt-header\s/.exec(extraArgs)

    const idMatch = /\bid\[([A-Za-z0-9_-]+?)]/.exec(extraArgs)
    const id = idMatch?.[1]
    const idAttr = id ? ` id="${id}"` : ''

    const content = resolveContent(title, isFullText)

    if (content) {
      logger.debug(`Insert ref for ${title}`)

      return renderReferenceBlock({
        content,
        idAttr,
        hasAlternateLook,
        hasAlernateHeader,
        shouldWrap,
        title,
        hasNoHeader,
      })
    } else {
      logger.error(chalk.red(`Ref not found: ${title}`))

      return match
    }
  })
}
