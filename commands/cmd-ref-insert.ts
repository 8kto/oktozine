/**
 * @file Insert referenced text sections from ModuleBuilderConfig.referenceFiles.
 * @example `<!-- cmd[ref] header[Летучая медуза] alt no-page-break detailed id[medusa] no-header alt-header /-->`
 */

import chalk from 'chalk'

import { logger } from '../lib/logger'
import { renderReferenceBlock } from '../lib/render-reference-block'
import { getReferenceResolver } from '../lib/resolve-reference-files'
import type { IModuleBuilderConfig, IPartProperties } from '../types'

export const convertRefInserts = (markdown: string, buildConf?: IPartProperties): string => {
  const commandPattern = /<!--\s*cmd\[ref]\s*header\[(.*?)]\s*(.*?)\/-->/gms
  if (!commandPattern.test(markdown)) {
    return markdown
  }

  const resolveContent = getReferenceResolver(buildConf as unknown as IModuleBuilderConfig)

  return markdown.replace(commandPattern, (match, title: string, extraArgs = '') => {
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
