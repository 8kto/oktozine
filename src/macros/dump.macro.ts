/**
 * @file Dumps all entries from a reference file as rendered HTML blocks.
 *
 * Accepts `<!-- cmd[dump] ref-file[$refs-items] /-->` and replaces it with
 * every entry in the named reference file rendered via {@link renderReferenceBlock},
 * using full text and the alternate look style — equivalent to what the
 * `dump-bestiary` script produces, but driven inline from Markdown.
 *
 * The `ref-file` argument is a filename stem (with or without `.md`) resolved
 * from `src/markdown/`. A bare path separator in the name is treated as a
 * project-root-relative path instead.
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

const resolveRefFilePath = (refFile: string, markdownDir: string): string => {
  const withExt = refFile.endsWith('.md') ? refFile : `${refFile}.md`

  return refFile.includes('/') ? withExt : path.join(markdownDir, withExt)
}

export const convertDumpInserts = (markdown: string, buildConf?: IDocumentConfig): string => {
  const commandPattern = /<!--\s*cmd\[dump]\s*ref-file\[([^\]]+)]\s*\/-->/gm
  if (!commandPattern.test(markdown)) {
    return markdown
  }

  const markdownDir = buildConf?.markdownDir ?? path.join(process.cwd(), 'src/markdown')

  return markdown.replace(commandPattern, (match, refFile: string) => {
    const filePath = resolveRefFilePath(refFile.trim(), markdownDir)
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
