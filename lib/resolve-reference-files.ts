import { existsSync, readFileSync } from 'node:fs'
import path from 'path'

import handleCommands from '../commands/index'
import type { IModuleBuilderConfig, IPartProperties, IRefEntry } from '../types'

const findProjectRoot = (startDir?: string): string => {
  let dir = path.resolve(startDir || process.cwd())
  for (;;) {
    const candidate = path.join(dir, 'package.json')
    if (existsSync(candidate)) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('package.json not found while resolving project root')
}

export const resolveReferenceFiles = (buildConf: Partial<IModuleBuilderConfig>): string[] => {
  if (!buildConf || !Array.isArray(buildConf.referenceFiles)) return []
  const root = findProjectRoot(process.cwd())

  return buildConf.referenceFiles.map((f) => (path.isAbsolute(f) ? f : path.resolve(root, f)))
}

const getFirstSentence = (str: string): string => {
  const match = str.match(/[^.]*\./)
  return match ? match[0] : str
}

const findLastNonSpaceEntry = (arr: string[]): string | null => {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].trim() !== '') {
      return arr[i]
    }
  }
  return null
}

const parseMarkdown = (md: string): Record<string, IRefEntry> => {
  const lines = md.split('\n')
  const buffer: Record<string, string[]> = {}
  let currentTitle = ''

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

  const result: Record<string, IRefEntry> = {}
  Object.entries(buffer).forEach(([key, refItem]) => {
    if (!result[key]) {
      result[key] = { fullText: '', shortText: '' }
    }
    result[key].fullText = refItem.join('\n')

    const lastNonSpaceEntry = findLastNonSpaceEntry(refItem)
    const hasStats = !!lastNonSpaceEntry?.startsWith('`{ ')
    result[key].shortText = hasStats ? lastNonSpaceEntry! : getFirstSentence(result[key].fullText)
  })

  return result
}

export const getReferenceDictionary = (filePaths: string[]): Record<string, IRefEntry> => {
  const markdownContent = filePaths.reduce((acc, cur) => acc + readFileSync(cur, 'utf8'), '')

  return parseMarkdown(markdownContent)
}

export const getReferenceResolver =
  (buildConf: IModuleBuilderConfig | IPartProperties): ((refId: string, fullText: boolean) => string | null) => {
    const filePaths = resolveReferenceFiles(buildConf)
    const storage = getReferenceDictionary(filePaths)

    return (refId: string, fullText: boolean): string | null => {
      const content = fullText ? storage[refId]?.fullText?.trim() : storage[refId]?.shortText?.trim()

      return content ? handleCommands(content, buildConf as IPartProperties) : null
    }
  }
