/**
 * @file Dumps all entries from a reference file as rendered HTML blocks.
 *
 * Accepts `<!-- cmd[dump] ref-file[$refs-items] /-->` and replaces it with
 * every entry in the named reference file rendered via {@link renderReferenceBlock},
 * using full text and the alternate look style — equivalent to what the
 * `dump-bestiary` script produces, but driven inline from Markdown.
 *
 * The `ref-file` argument is a filename stem (with or without `.md`) resolved
 * from `markdownPath` (defaults to `<cwd>/src/markdown`). Subdirectory paths
 * such as `ru/$refs-stats.md` are resolved relative to `markdownPath` as well.
 * Only absolute paths are used verbatim.
 *
 * @module macros/dump
 *
 * @example
 * ```markdown
 * <!-- cmd[dump] ref-file[$refs-items] /-->
 * <!-- cmd[dump] ref-file[$refs-stats.md] /-->
 * ```
 */

import { existsSync } from 'node:fs'
import path from 'node:path'

import { slugify } from 'transliteration'

import { logger } from '../lib/logger'
import { renderReferenceBlock } from '../lib/render-reference-block'
import { getReferenceDictionary, resolveReferenceFiles } from '../lib/resolve-reference-files'
import type { IDocumentConfig } from '../types'

const resolveRefFilePath = (refFile: string, markdownPath: string): string => {
  const withExt = refFile.endsWith('.md') ? refFile : `${refFile}.md`

  return path.isAbsolute(withExt) ? withExt : path.join(markdownPath, withExt)
}

export const convertDumpInserts = (markdown: string, buildConf?: IDocumentConfig): string => {
  const commandPattern = /<!--\s*cmd\[dump]\s*ref-file\[([^\]]+)]\s*\/-->/gm
  if (!commandPattern.test(markdown)) {
    return markdown
  }

  const markdownPath = buildConf?.markdownPath ?? path.join(process.cwd(), 'src/markdown')

  return markdown.replace(commandPattern, (match, refFile: string) => {
    const filePath = resolveRefFilePath(refFile.trim(), markdownPath)
    const [resolvedPath] = resolveReferenceFiles({ referenceFiles: [filePath] })

    if (!resolvedPath || !existsSync(resolvedPath)) {
      logger.error(`dump: ref file not found: ${filePath}`)

      return match
    }

    const storage = getReferenceDictionary([resolvedPath])

    return Object.entries(storage)
      .map(([title, ref]) =>
        renderReferenceBlock({
          title,
          content: ref.fullText,
          idAttr: ` id="${slugify(title)}"`,
          hasAlternateLook: true,
          headerTagName: 'h3',
          shouldWrap: false,
        }),
      )
      .join('\n')
  })
}
