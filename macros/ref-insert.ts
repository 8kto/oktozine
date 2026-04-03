/**
 * @file Inlines referenced text sections from the reference dictionary.
 *
 * Reference files (`$refs-*.md`) are standard Markdown files where each
 * `## Heading` defines a named content block. This macro finds
 * `<!-- cmd[ref] header[Name] … /-->` directives and replaces them with the
 * resolved block content, rendered through {@link renderReferenceBlock}.
 *
 * Content from reference files is itself run through the full macro pipeline
 * (via `handleMacros` in `resolve-reference-files.ts`), **except** for
 * `convertRefInserts` itself, to prevent infinite recursion.
 *
 * @module macros/ref-insert
 *
 * @example Short (summary) insert
 * ```markdown
 * <!-- cmd[ref] header[Летучая медуза] /-->
 * ```
 *
 * @example Full (detailed) insert with all modifiers
 * ```markdown
 * <!-- cmd[ref] header[Летучая медуза] detailed no-page-break alt no-header alt-header id[medusa] /-->
 * ```
 *
 * @example Via item/stats shorthand (expanded by `addAliases` before this macro runs)
 * ```markdown
 * <!-- item[Меч-кладенец] no-page-break /-->
 * <!-- stats[Goblin] /-->
 * ```
 */

import chalk from 'chalk'

import { logger } from '../lib/logger'
import { renderReferenceBlock } from '../lib/render-reference-block'
import { getReferenceResolver } from '../lib/resolve-reference-files'
import type { IModuleBuilderConfig, IPartProperties } from '../types'

/**
 * Replace `<!-- cmd[ref] header[…] … /-->` directives with rendered
 * reference block content.
 *
 * Supported modifiers (space-separated after the header):
 *
 * | Modifier       | Effect |
 * |----------------|--------|
 * | `detailed`     | Use the full block text instead of the short (first-sentence) version. |
 * | `no-page-break`| Wrap the block in a container that suppresses page breaks before it. |
 * | `alt`          | Apply an alternate visual style (`ref-insert.alternative` class). |
 * | `no-header`    | Omit the block's heading from the output. |
 * | `alt-header`   | Use the alternate heading style (`ref-header--alt` class). |
 * | `id[value]`    | Set `id="value"` on the wrapper `<section>` element. |
 *
 * @param markdown  - Source Markdown string.
 * @param buildConf - Part configuration; used to resolve reference file paths
 *                    and to run the macro pipeline on resolved content.
 * @returns Markdown with reference directives replaced by rendered HTML blocks.
 *          Unresolved references are logged as errors and left unchanged.
 */
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
    const hasAlternateHeader = !!/\salt-header\s/.exec(extraArgs)

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
        hasAlternateHeader,
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
