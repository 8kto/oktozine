import fs from 'fs-extra'

import type { IDocPage } from '../types'

/**
 * Reads the last build timestamp from disk.
 * @returns Milliseconds since epoch of the last build; 0 if unreadable.
 */
export const getLastBuildTime = (buildFilePath: string): number => {
  try {
    const content = fs.readFileSync(buildFilePath, 'utf8').trim()
    const ts = Number(content)

    return isNaN(ts) ? 0 : ts
  } catch {
    return 0
  }
}

/** Updates (or creates) the last-build timestamp file to right now. */
export const updateLastBuildTime = (buildFilePath: string): void => {
  const now = Date.now().toString()
  fs.writeFileSync(buildFilePath, now, 'utf8')
}

/** Returns true if filename's mtime is after last build (i.e. was changed since). */
export const isFileChangedSinceLastBuild = (buildFilePath: string, filename: string): boolean => {
  let stat

  try {
    stat = fs.statSync(filename)
  } catch {
    return true
  }

  const lastBuild = getLastBuildTime(buildFilePath)
  const mtime = stat.mtimeMs

  return mtime > lastBuild
}

export const getBuildFilePath = (id: string): string => {
  return `/tmp/HTML_BUILDER_LAST_BUILD$-${id}.txt`
}

export const PAGE_BREAK_DELIMITER = '<!-- cmd[break-page] /-->'

export const recalculatePages = (docPageData: IDocPage): IDocPage[] => {
  const { content } = docPageData
  const name = docPageData.metadata.name

  const pages = content.split(PAGE_BREAK_DELIMITER)

  return pages.map((pContent, idx) => {
    return {
      ...docPageData,
      metadata: {
        ...docPageData.metadata,
        name: name && idx ? `${name}-${idx + 1}` : name,
        seqPage: !!idx,
        seqPageNum: idx,
      },
      content: pContent.trim().concat('\n'),
    }
  })
}
