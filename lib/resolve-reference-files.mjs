// resolve-reference-files.mjs
import { existsSync } from 'node:fs'
import path from 'path'
import { readFileSync } from 'node:fs'

import handleCommands from '../commands/index.mjs'

/**
 * @global
 * @typedef {object} RefEntry
 * @property {string} fullText - The full text of the entry
 * @property {string} shortText - The shortened version of the text
 * @property {string[]} buffer - Full text as an array of lines
 */

function findProjectRoot(startDir) {
  let dir = path.resolve(startDir || process.cwd())
  // walk up until we find package.json
  for (;;) {
    const candidate = path.join(dir, 'package.json')
    if (existsSync(candidate)) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('package.json not found while resolving project root')
}

/**
 * Resolve buildConf.referenceFiles against the project root
 *
 * @param {Partial<ModuleBuilderConfig>} buildConf
 * @returns {string[]}
 */
export const resolveReferenceFiles = (buildConf) => {
  if (!buildConf || !Array.isArray(buildConf.referenceFiles)) return []
  const root = findProjectRoot(process.cwd())

  return buildConf.referenceFiles.map((f) => (path.isAbsolute(f) ? f : path.resolve(root, f)))
}

const getFirstSentence = (str) => {
  // Match everything up to the first dot
  const match = str.match(/[^.]*\./)

  return match ? match[0] : str
}

const findLastNonSpaceEntry = (arr) => {
  // Iterate from the last element to the first
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].trim() !== '') {
      return arr[i]
    }
  }

  return null
}

/**
 * @param {string} md
 * @returns {Record<string, RefEntry>}
 */
const parseMarkdown = (md) => {
  const lines = md.split('\n')

  /** @type {Record<string, string[]>} */
  const buffer = {}
  let currentTitle = ''

  // Collect full texts
  lines.forEach((line) => {
    if (line.startsWith('## ')) {
      currentTitle = line.substring('## '.length).trim()
      if (!currentTitle) {
        throw new Error(`Empty title in line [${line}]`)
      }

      buffer[currentTitle] = []
    } else if (currentTitle) {
      if (line.startsWith('# ')) {
        currentTitle = ''

        return
      }

      buffer[currentTitle].push(line.trim())
    }
  })

  /** @type {Record<string, RefEntry>} */
  const result = {}
  Object.entries(buffer).forEach(([key, refItem]) => {
    if (!result[key]) {
      result[key] = {}
    }
    result[key].fullText = refItem.join('\n')

    const lastNonSpaceEntry = findLastNonSpaceEntry(refItem)

    // NB faster comparison instead of regexp
    const hasStats = !!lastNonSpaceEntry?.startsWith('`{ ')
    result[key].shortText = hasStats ? lastNonSpaceEntry : getFirstSentence(result[key].fullText)
  })

  return result
}

/**
 * @param {string[]} filePaths
 * @returns {Record<string, RefEntry>}
 */
export const getReferenceDictionary = (filePaths) => {
  /** @type {string} */
  const markdownContent = filePaths.reduce((acc, cur) => {
    return acc + readFileSync(cur, 'utf8')
  }, '')

  return parseMarkdown(markdownContent)
}

/**
 * @param {ModuleBuilderConfig} buildConf
 * @returns {(id: string, fullText: boolean) => string|null}
 */
export const getReferenceResolver = (buildConf) => {
  const filePaths = resolveReferenceFiles(buildConf)
  const storage = getReferenceDictionary(filePaths)

  /**
   * @param {string} refId
   * @param {boolean} fullText
   * @returns {string|null}
   */
  return (refId, fullText) => {
    const content = fullText ? storage[refId]?.fullText?.trim() : storage[refId]?.shortText?.trim()

    return content ? handleCommands(content, buildConf) : null
  }
}
