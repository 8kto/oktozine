import fs from 'fs-extra'

/**
 * Reads the last build timestamp from disk.
 * @param {string} buildFilePath
 * @returns {number} Milliseconds since epoch of the last build; 0 if unreadable.
 */
export const getLastBuildTime = (buildFilePath) => {
  try {
    const content = fs.readFileSync(buildFilePath, 'utf8').trim()
    const ts = Number(content)

    return isNaN(ts) ? 0 : ts
  } catch {
    // If the file doesn’t exist or can’t be parsed, treat as “never built”
    return 0
  }
}

/**
 * Updates (or creates) the last‐build timestamp file to right now.
 * @param {string} buildFilePath
 */
export const updateLastBuildTime = (buildFilePath) => {
  const now = Date.now().toString()
  fs.writeFileSync(buildFilePath, now, 'utf8')
}

/**
 * @param {string} buildFilePath
 * @param {string} filename
 * @returns {boolean} true if filename’s mtime is *after* last build (i.e. was changed since)
 */
export const isFileChangedSinceLastBuild = (buildFilePath, filename) => {
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

/**
 * @param {string} id
 * @returns {string}
 */
export const getBuildFilePath = (id) => {
  return `/tmp/HTML_BUILDER_LAST_BUILD$-${id}.txt`
}

export const PAGE_BREAK_DELIMITER = '<!-- cmd[break-page] /-->'

/**
 * @param {DocPage} docPageData
 * @returns {DocPage[]}
 */
export const recalculatePages = (docPageData) => {
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
