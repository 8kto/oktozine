#!/bin/env node

import chalk from 'chalk'
import fs from 'fs-extra'
import matter from 'gray-matter'
import path from 'path'

import packageConfig from '../../package.json' with { type: 'json' }
import { getBuildFilePath, isFileChangedSinceLastBuild, recalculatePages, updateLastBuildTime } from './lib/build-utils'
import { logger } from './lib/logger'
import { getMarkdownRenderer } from './lib/markdown'
import { measure } from './lib/measure'
import { OKTOZINE_ROOT, PROJECT_ROOT } from './lib/project-root'
import handleMacros from './macros/index'
import type { IDocPage, IPartProperties } from './types'

const defaultBuildDir = path.join(PROJECT_ROOT, 'build')
const markdownSourcesDir = path.join(PROJECT_ROOT, 'src/markdown')
const htmTemplateslDir = path.join(PROJECT_ROOT, 'src/html')

/** ---------------------------- fs helpers --------------------------------- */

const errToShort = (err: unknown): string => {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    const code = e.code ? ` code=${String(e.code)}` : ''
    const p = e.path ? ` path=${String(e.path)}` : ''
    const sc = e.syscall ? ` syscall=${String(e.syscall)}` : ''
    const msg = e.message ? ` msg=${String(e.message)}` : ` ${String(err)}`

    return `${msg}${code}${sc}${p}`
  }

  return String(err)
}

const fsPhase = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn()
  } catch (err) {
    throw new Error(`${label} (${errToShort(err)})`, { cause: err })
  }
}

const fsPhaseSync = <T>(label: string, fn: () => T): T => {
  try {
    return fn()
  } catch (err) {
    throw new Error(`${label} (${errToShort(err)})`, { cause: err })
  }
}

/** -------------------------- core transforms ------------------------------ */

const convertMarkdownToHtml = async (
  filePath: string,
  mdRenderer: ReturnType<typeof getMarkdownRenderer>,
  config: IPartProperties,
): Promise<IDocPage> => {
  const content = await fsPhase(`read markdown`, () => fs.readFile(filePath, 'utf8'))

  let frontMatter
  try {
    frontMatter = matter(content)
  } catch (err) {
    throw new Error(`parse front-matter failed for ${filePath}`, { cause: err })
  }

  let processedContent
  try {
    processedContent = handleMacros(frontMatter.content, config)
  } catch (err) {
    throw new Error(`handleMacros failed for ${filePath}`, { cause: err })
  }

  let htmlContent
  try {
    htmlContent = mdRenderer.render(processedContent)
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

const applyTemplate = async (data: IDocPage, templatePath: string): Promise<string> => {
  const { content, metadata } = data
  const template = await fsPhase(`read template`, () => fs.readFile(templatePath, 'utf8'))

  let res = template
    .replace('{{header}}', metadata.header ?? '')
    .replace('{{footer}}', metadata.footer ?? '')
    .replace('{{content}}', content)

  if (Array.isArray(metadata.use)) {
    // Quick workaround
    if (metadata.use.includes('version')) {
      const sfx = process.env.BUILD_MODE === 'production' ? '' : '-dev'
      res = res.replace('{{version}}', `v${packageConfig.version}${sfx}`)
    }
    if (metadata.use.includes('documentTitle')) {
      res = res.replace('{{documentTitle}}', metadata.documentTitle ?? '')
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
    res = res.replace('{{pictureId}}', metadata['picture-id'] as string)
  }

  return res
}

export const prepareHtmlBuild = async (outputDir?: string): Promise<void> => {
  const buildDir = outputDir ?? defaultBuildDir
  const htmlBuildDir = path.join(buildDir, 'chunks-html')

  if (!fs.existsSync(htmlBuildDir)) {
    fs.mkdirSync(htmlBuildDir, { recursive: true })
  }

  await fsPhase('copy static assets into chunks-html', async () => {
    await Promise.all([
      // FIXME paths set outside of the oktozine codebase
      fs.copy(path.join(buildDir, 'output.css'), path.join(htmlBuildDir, 'output.css')),
      fs.copy(path.join(OKTOZINE_ROOT, 'webviewer/index.html'), path.join(htmlBuildDir, 'server.html')),
      fs.copy(path.join(PROJECT_ROOT, 'src/images/'), path.join(htmlBuildDir, 'images/')),
      fs.copy(path.join(PROJECT_ROOT, 'src/styles/fonts'), path.join(htmlBuildDir, 'fonts/')),
    ])
  })
}

const shouldRebuildAllFiles = (
  markdownSrcDir: string,
  markdownFiles: string[],
  { id, invalidateBuildOnPattern }: IPartProperties,
): boolean => {
  let forceRebuildAll = false

  if (invalidateBuildOnPattern) {
    const allMarkdownFiles = [...markdownFiles]
    const buildFilePath = getBuildFilePath(id)

    logger.debug(chalk.cyan(`Checking the last build timestamp: ${buildFilePath}`))

    for (const file of allMarkdownFiles) {
      if (invalidateBuildOnPattern.test(file)) {
        const filePath = path.join(markdownSrcDir, file)
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

const filterFiles = (config: IPartProperties, files: string[]): string[] => {
  const { skipped, includePattern, include } = config

  const hasSkipped = Array.isArray(skipped) && skipped.length > 0
  const hasInclude = Array.isArray(include) && include.length > 0
  const hasPattern = Boolean(includePattern)

  return files.filter((file) => {
    let keep = true

    if (hasSkipped) {
      keep = !skipped!.includes(file)
    }
    if (hasPattern) {
      keep = includePattern!.test(file)
    }
    if (hasInclude) {
      keep = include!.includes(file)
    }

    return keep
  })
}

const renderToHtml = async (pageData: IDocPage, buildDir: string, fileName: string): Promise<void> => {
  const { metadata } = pageData
  const { template, seqPage, seqPageNum } = metadata

  if (!metadata.template) {
    throw new Error(`Missing "template" in front-matter for ${fileName}`)
  }

  if (seqPage) {
    fileName = fileName.replace('.md', `-${seqPageNum}.md`)
  }

  const templatePath = path.join(htmTemplateslDir, template!)
  const html = await applyTemplate(pageData, templatePath)

  const outPath = path.join(buildDir, `${fileName}.html`)
  await fsPhase(`write html ${outPath}`, () => fs.writeFile(outPath, html))

  logger.info(chalk.cyan(`>> Generated HTML for ${fileName}`))
}

export const buildHtml = async (config: IPartProperties, outputDir?: string): Promise<void> => {
  logger.info(chalk.cyan(`Building HTML for "${config.documentTitle}" (${config.documentFileName})...`))
  const endBuildHtmlMeasure = measure()

  if (config.includePattern && config.include) {
    logger.error(chalk.red('Config error: includePattern + include will not work'))

    return
  }

  const buildDir = path.join(outputDir ?? defaultBuildDir, 'chunks-html', `module-${config.id}`)
  const markdownRenderer = getMarkdownRenderer()

  await fsPhase(`ensureDir ${buildDir}`, () => fs.ensureDir(buildDir))
  let markdownFiles = await fsPhase(`readdir ${markdownSourcesDir}`, () => fs.readdir(markdownSourcesDir))

  const forceRebuildAll = shouldRebuildAllFiles(markdownSourcesDir, markdownFiles, config)
  markdownFiles = filterFiles(config, markdownFiles)

  if (process.env.HTML_NO_SKIP) {
    logger.info(chalk.cyan('>> HTML_NO_SKIP flag: all files to rebuild'))
  }

  const isHtmlBuilt = (file: string): boolean => {
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
