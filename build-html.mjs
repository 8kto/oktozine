#!/bin/env node

import chalk from 'chalk'
import fs from 'fs-extra'
import matter from 'gray-matter'
import path from 'path'
import { fileURLToPath } from 'url'

import handleCommands from './commands/index.mjs'

import packageConfig from '../../package.json' with { type: 'json' }
import {
  getBuildFilePath,
  isFileChangedSinceLastBuild,
  recalculatePages,
  updateLastBuildTime,
} from './lib/build-utils.mjs'
import { logger } from './lib/logger.mjs'
import { getMarkdownRenderer } from './lib/markdown.mjs'
import { measure } from './lib/measure.mjs'
// import { hyphenateHtml } from './hyphenate.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const markdownSourcesDir = path.join(__dirname, '../../src/markdown')
const htmTemplateslDir = path.join(__dirname, '../../src/html')

/**
 * @global
 * @typedef {object} DocPageMetadata
 * @property {string} [template]
 * @property {string} [name]
 * @property {string[]} [use]
 * @property {string} [picture-id]
 */

/**
 * @global
 * @typedef {object} DocPage
 * @property {ModuleBuilderConfig & DocPageMetadata} metadata
 * @property {string} content
 */

/** ---------------------------- fs helpers --------------------------------- */

/**
 * @param {unknown} err
 * @returns {string}
 */
const errToShort = (err) => {
  if (err && typeof err === 'object') {
    const e = /** @type {any} */ (err)
    const code = e.code ? ` code=${String(e.code)}` : ''
    const p = e.path ? ` path=${String(e.path)}` : ''
    const sc = e.syscall ? ` syscall=${String(e.syscall)}` : ''
    const msg = e.message ? ` msg=${String(e.message)}` : ` ${String(err)}`

    return `${msg}${code}${sc}${p}`
  }

  return String(err)
}

/**
 * Wrap an async fs operation with context. Rethrows with cause.
 * @template T
 * @param {string} label
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
const fsPhase = async (label, fn) => {
  try {
    return await fn()
  } catch (err) {
    // Anchor stack here, preserve original in cause.
    throw new Error(`${label} (${errToShort(err)})`, { cause: err })
  }
}

/**
 * Wrap a sync fs operation with context. Rethrows with cause.
 * @template T
 * @param {string} label
 * @param {() => T} fn
 * @returns {T}
 */
const fsPhaseSync = (label, fn) => {
  try {
    return fn()
  } catch (err) {
    throw new Error(`${label} (${errToShort(err)})`, { cause: err })
  }
}

/** -------------------------- core transforms ------------------------------ */

/**
 * @param {string} filePath
 * @param {MarkdownIt} mdRenderer
 * @param {PartProperties} config
 * @returns {Promise<DocPage>}
 */
const convertMarkdownToHtml = async (filePath, mdRenderer, config) => {
  const content = await fsPhase(`read markdown`, () => fs.readFile(filePath, 'utf8'))

  let frontMatter
  try {
    frontMatter = matter(content)
  } catch (err) {
    throw new Error(`parse front-matter failed for ${filePath}`, { cause: err })
  }

  let processedContent
  try {
    processedContent = handleCommands(frontMatter.content, config)
  } catch (err) {
    throw new Error(`handleCommands failed for ${filePath}`, { cause: err })
  }

  let htmlContent
  try {
    htmlContent = mdRenderer.render(processedContent)
    // htmlContent = await hyphenateHtml(mdRenderer.render(processedContent))
  } catch (err) {
    throw new Error(`markdown render failed for ${filePath}`, { cause: err })
  }

  return {
    // TODO figure out why the entire build config is needed here
    metadata: {
      ...config,
      ...frontMatter.data,
    },
    content: htmlContent,
  }
}

/**
 * @param {DocPage} data
 * @param {string} templatePath
 * @returns {Promise<string>}
 */
const applyTemplate = async (data, templatePath) => {
  const { content, metadata } = data
  const template = await fsPhase(`read template`, () => fs.readFile(templatePath, 'utf8'))

  let res = template
    .replace('{{header}}', metadata.header)
    .replace('{{footer}}', metadata.footer)
    .replace('{{content}}', content)

  if (Array.isArray(metadata.use)) {
    // Quick workaround
    if (metadata.use.includes('version')) {
      const sfx = process.env.BUILD_MODE === 'production' ? '' : '-dev'
      res = res.replace('{{version}}', `v${packageConfig.version}${sfx}`)
    }
    if (metadata.use.includes('documentTitle')) {
      res = res.replace('{{documentTitle}}', metadata.documentTitle)
    }
    if (metadata.use.includes('buildMode')) {
      res = res.replace(
        '{{buildMode}}',
        process.env.BUILD_MODE === 'production' ? '' : `<strong>Черновая версия, не для распространения</strong>`,
      )
    }
  }

  if (metadata.name) {
    res = res.replace('data-id-placeholder', `id="${metadata.name}" data-id="${metadata.name}"`)
  }
  if (metadata['picture-id']) {
    res = res.replace('{{pictureId}}', metadata['picture-id'])
  }

  return res
}

export const prepareHtmlBuild = async () => {
  const buildDir = path.join(__dirname, '../../build/chunks-html')

  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true })
  }

  await fsPhase('copy static assets into chunks-html', async () => {
    await Promise.all([
      // FIXME abstract
      fs.copy(path.join(__dirname, '../../server/index.html'), path.join(buildDir, 'server.html')),
      fs.copy(path.join(__dirname, '../../build/output.css'), path.join(buildDir, 'output.css')),
      fs.copy(path.join(__dirname, '../../src/images/'), path.join(buildDir, 'images/')),
      fs.copy(path.join(__dirname, '../../src/styles/fonts'), path.join(buildDir, 'fonts/')),
    ])
  })
}

/**
 * @param {string} markdownSourcesDir
 * @param {string[]} markdownFiles
 * @param {PartProperties} config
 * @returns {boolean}
 */
const shouldRebuildAllFiles = (markdownSourcesDir, markdownFiles, { id, invalidateBuildOnPattern }) => {
  let forceRebuildAll = false

  // Pre‐compute: if any file matches invalidateBuildOnPattern AND is stale,
  // then force a rebuild of every file (i.e., skip logic is bypassed).
  if (invalidateBuildOnPattern) {
    const allMarkdownFiles = [...markdownFiles]
    const buildFilePath = getBuildFilePath(id)

    logger.debug(chalk.cyan(`Checking the last build timestamp: ${buildFilePath}`))

    for (const file of allMarkdownFiles) {
      if (invalidateBuildOnPattern.test(file)) {
        const filePath = path.join(markdownSourcesDir, file)
        let changed = false
        try {
          changed = isFileChangedSinceLastBuild(buildFilePath, filePath)
        } catch (err) {
          throw new Error(`isFileChangedSinceLastBuild failed for ${filePath}`, { cause: err })
        }

        if (changed) {
          logger.info(chalk.cyan(`Triggering rebuilding of all HTML files for the "${file}" updated`))

          forceRebuildAll = true
          break
        }
      }
    }
  }

  return forceRebuildAll
}

/**
 * @param {PartProperties} config
 * @param {string[]} files
 * @returns {string[]}
 */
const filterFiles = (config, files) => {
  const { skipped, includePattern, include } = config

  const hasSkipped = Array.isArray(skipped) && skipped.length > 0
  const hasInclude = Array.isArray(include) && include.length > 0
  const hasPattern = Boolean(includePattern)

  return files.filter((file) => {
    let keep = true

    if (hasSkipped) {
      keep = !skipped.includes(file)
    }
    if (hasPattern) {
      keep = includePattern.test(file)
    }
    if (hasInclude) {
      keep = include.includes(file)
    }

    return keep
  })
}

/**
 * @param {DocPage} pageData
 * @param {string} buildDir
 * @param {string} fileName
 * @returns {Promise<void>}
 */
const renderToHtml = async (pageData, buildDir, fileName) => {
  const { metadata } = pageData
  const { template, seqPage, seqPageNum } = metadata

  if (!metadata.template) {
    throw new Error(`Missing "template" in front-matter for ${fileName}`)
  }

  if (seqPage) {
    fileName = fileName.replace('.md', `-${seqPageNum}.md`)
  }

  const templatePath = path.join(htmTemplateslDir, template)
  const html = await applyTemplate(pageData, templatePath)

  const outPath = path.join(buildDir, `${fileName}.html`)
  await fsPhase(`write html ${outPath}`, () => fs.writeFile(outPath, html))
  // await fs.writeFile(path.join(buildDir, `${fileName}.html`), hyphenateHtml(html))

  logger.info(chalk.cyan(`>> Generated HTML for ${fileName}`))
}

/**
 * @param {PartProperties} config
 * @returns {Promise<void>}
 */
export const buildHtml = async (config) => {
  logger.info(chalk.cyan(`Building HTML for "${config.documentTitle}" (${config.documentFileName})...`))
  const endBuildHtmlMeasure = measure()

  if (config.includePattern && config.include) {
    logger.error(chalk.red('Config error: includePattern + include will not work'))

    return
  }

  const buildDir = path.join(__dirname, '../../build/chunks-html', `module-${config.id}`)
  const markdownRenderer = getMarkdownRenderer()

  await fsPhase(`ensureDir ${buildDir}`, () => fs.ensureDir(buildDir))
  let markdownFiles = await fsPhase(`readdir ${markdownSourcesDir}`, () => fs.readdir(markdownSourcesDir))

  const forceRebuildAll = shouldRebuildAllFiles(markdownSourcesDir, markdownFiles, config)
  markdownFiles = filterFiles(config, markdownFiles)

  if (process.env.HTML_NO_SKIP) {
    logger.info(chalk.cyan('>> HTML_NO_SKIP flag: all files to rebuild'))
  }

  const isHtmlBuilt = (file) => {
    const outPath = path.join(buildDir, `${file}.html`)

    return fsPhaseSync(`pathExistsSync ${outPath}`, () => fs.pathExistsSync(outPath))
  }

  const buildFilePath = getBuildFilePath(config.id)

  /* THROUGH THE MATCHED FILES */
  const processes = markdownFiles.map(async (fileName) => {
    try {
      if (!fileName.endsWith('.md')) {
        logger.debug(`>> Skipped ${fileName}, no .md extension`)

        return null
      }

      const filePath = path.join(markdownSourcesDir, fileName)

      if (!process.env.HTML_NO_SKIP) {
        let changed = true
        try {
          changed = isFileChangedSinceLastBuild(buildFilePath, filePath)
        } catch (err) {
          throw new Error(`isFileChangedSinceLastBuild failed for ${filePath}`, { cause: err })
        }

        if (!forceRebuildAll && !changed) {
          // Rebuild if file is not found
          if (isHtmlBuilt(fileName)) {
            logger.debug(`>> Skipped ${fileName}, file not changed since last build`)

            return null
          }
        }
      }

      const data = await convertMarkdownToHtml(filePath, markdownRenderer, config)
      const pagesData = recalculatePages(data)

      return Promise.all(pagesData.map(async (pageData) => renderToHtml(pageData, buildDir, fileName)))
    } catch (err) {
      // Add per-file context so Promise.all surfaces a helpful label.
      throw new Error(`HTML generation failed for source "${fileName}" (part "${config.id}")`, { cause: err })
    }
  })

  await fsPhase(`Promise.all(html generation) for part "${config.id}"`, () => Promise.all(processes))

  try {
    updateLastBuildTime(buildFilePath)
  } catch (err) {
    throw new Error(`updateLastBuildTime failed (${buildFilePath})`, { cause: err })
  }

  const buildHtmlMeasure = endBuildHtmlMeasure()
  logger.info(chalk.cyan(`>> HTML build ended in ${buildHtmlMeasure}`))
}
