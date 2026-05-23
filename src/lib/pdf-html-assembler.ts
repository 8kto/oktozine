// scripts/oktozine/lib/pdf-html-assembler.ts
import fs from 'fs-extra'
import path from 'path'

import type { IDocumentConfig } from '../types'
import { logger } from './logger'

// ── Internal helpers ─────────────────────────────────────────────────────────

const isIncremented = (name: string): boolean => /-\d+\.md\.html$/.test(name)
const baseName = (name: string): string => name.replace(/-\d+\.md\.html$/, '.md.html')

// ── Exports ──────────────────────────────────────────────────────────────────

export const getPageClassname = (moduleId: string, fileName: string): string => {
  const pageName = fileName.replace('.md.html', '').replace(/^\d+-/, '')

  return `page--wrapper page--${moduleId} page--${moduleId}-${pageName} page-name--${pageName}`
}

export const getPageTemplate = (
  moduleId: string,
  fileName: string,
  pageContent: string,
  skipDelimiter = false,
): string =>
  `<div class="${getPageClassname(moduleId, fileName)}">
    ${pageContent}
  </div>${skipDelimiter ? '' : '<div class="page-delimiter"></div>' + `<!-- ${fileName} -->`}`

export const getFullPageTemplate = (content: string): string =>
  `<div class="page-bg"></div><div class="full-content-container">${content}</div>`

/** Sorts HTML chunk files alphabetically; incremented variants (e.g. `-2.md.html`) sort after their base. */
export const compareHtmlFiles = (a: string, b: string): number => {
  const baseA = baseName(a)
  const baseB = baseName(b)
  if (baseA === baseB) {
    const incA = isIncremented(a)
    const incB = isIncremented(b)
    if (incA !== incB) {
      return incA ? 1 : -1
    }
  }

  return a.localeCompare(b)
}

/**
 * Reads and filters all HTML page files in moduleDir, excluding the given files
 * and internal build artifacts (files prefixed with `$` or named `server.html`).
 * Returns sorted `[filename, content]` pairs.
 */
export const readModuleHtmlPages = async (
  moduleDir: string,
  excludeFiles: Array<string | null>,
): Promise<Array<[string, string]>> => {
  const allFiles = await fs.readdir(moduleDir)
  const excluded = new Set(excludeFiles.filter((f): f is string => f !== null))

  const entries = await Promise.all(
    [...new Set(allFiles)].map(async (file): Promise<[string, string] | null> => {
      if (!file.endsWith('.html') || file.startsWith('$') || file === 'server.html' || excluded.has(file)) {
        return null
      }
      const content = await fs.readFile(path.join(moduleDir, file), 'utf8')

      return [file, content]
    }),
  )

  return entries.filter((x): x is [string, string] => x !== null).sort(([a], [b]) => compareHtmlFiles(a, b))
}

/** Concatenates cover, sorted page fragments, and back-cover into the full HTML body string. */
export const assembleDocumentHtml = (
  config: IDocumentConfig,
  coverContent: string | null,
  sortedPages: Array<[string, string]>,
  backCoverContent: string | null,
): string => {
  const coverFile = config.coverHtmlFile ? `${config.coverHtmlFile}.html` : null
  const backCoverFile = config.backCoverHtmlFile ? `${config.backCoverHtmlFile}.html` : null

  let html = ''

  if (coverFile && coverContent) {
    html += getPageTemplate(config.id, coverFile, coverContent, true)
  }

  sortedPages.forEach(([file, txt], index, arr) => {
    logger.debug(`>> PDF includes ${file}`)
    html += getPageTemplate(config.id, file, txt, index >= arr.length - 1)
  })

  if (backCoverFile && backCoverContent) {
    html += getPageTemplate(config.id, backCoverFile, backCoverContent, true)
  }

  return html
}
