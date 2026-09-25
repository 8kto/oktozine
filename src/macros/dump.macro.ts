/**
 * @file Dumps all entries from a reference file as rendered HTML blocks.
 *
 * Accepts `<!-- cmd[dump] ref-file[$refs-items] /-->` and replaces it with
 * every entry in the named reference file rendered via {@link renderReferenceBlock},
 * using full text and the alternate look style — equivalent to what the
 * `dump-bestiary` script produces, but driven inline from Markdown.
 *
 * The `ref-file` argument is a filename stem (with or without `.md`) resolved
 * from the document's resolved `markdownPath` (see `resolveContentPaths`). Subdirectory paths
 * such as `ru/$refs-stats.md` are resolved relative to `markdownPath` as well.
 * Only absolute paths are used verbatim.
 *
 * An optional `sorted` argument sorts entries by title before dumping: bare
 * `sorted` or `sorted[asc]` sorts ascending, `sorted[desc]` descending.
 *
 * @module macros/dump
 * @pipeline markdown
 *
 * @example
 * ```markdown
 * <!-- cmd[dump] ref-file[$refs-items] /-->
 * <!-- cmd[dump] ref-file[$refs-stats.md] /-->
 * <!-- cmd[dump] ref-file[$refs-items] sorted /-->
 * <!-- cmd[dump] ref-file[$refs-items] sorted[desc] /-->
 * <!-- cmd[dump] ref-file[$refs-items] sorted[asc] /-->
 * ```
 */

import { existsSync } from 'node:fs'
import path from 'node:path'

import { slugify } from 'transliteration'

import { logger } from '../lib/logger'
import { resolveContentPaths } from '../lib/paths'
import { renderReferenceBlock } from '../lib/render-reference-block'
import { getReferenceDictionary, resolveReferenceFiles } from '../lib/resolve-reference-files'
import type { IDocumentConfig } from '../types'

const resolveRefFilePath = (refFile: string, markdownPath: string): string => {
  const withExt = refFile.endsWith('.md') ? refFile : `${refFile}.md`

  return path.isAbsolute(withExt) ? withExt : path.join(markdownPath, withExt)
}

export const convertDumpInserts = (markdown: string, buildConf?: IDocumentConfig): string => {
  const commandPattern = /<!--\s*cmd\[dump]\s*ref-file\[([^\]]+)]\s*(sorted(?:\[(asc|desc)])?)?\s*\/-->/gm
  if (!commandPattern.test(markdown)) {
    return markdown
  }

  const { markdownPath } = resolveContentPaths(buildConf ?? {})

  return markdown.replace(commandPattern, (match, refFile: string, sorted?: string, sortDirection?: string) => {
    const filePath = resolveRefFilePath(refFile.trim(), markdownPath)
    const [resolvedPath] = resolveReferenceFiles({ referenceFiles: [filePath] })

    if (!resolvedPath || !existsSync(resolvedPath)) {
      logger.error(`dump: ref file not found: ${filePath}`)

      return match
    }

    const storage = getReferenceDictionary([resolvedPath])
    let entries = Object.entries(storage)

    if (sorted) {
      const direction = sortDirection ?? 'asc'
      entries = entries.slice().sort(([titleA], [titleB]) => {
        const comparison = titleA.localeCompare(titleB)

        return direction === 'desc' ? -comparison : comparison
      })
    }

    return entries
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
