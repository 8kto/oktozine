#!/bin/env node

import chalk from 'chalk'
import fs from 'fs-extra'
import matter from 'gray-matter'
import path from 'path'

import { getBuildFilePath, isFileChangedSinceLastBuild, recalculatePages, updateLastBuildTime } from './lib/build-utils'
import { getConsumingAppVersion } from './lib/config'
import { logger } from './lib/logger'
import { getMarkdownRenderer } from './lib/markdown'
import { measure } from './lib/measure'
import { getCssPath, getHtmlBuildPath, getHtmlModuleBuildPath, OKTOZINE_ROOT, resolveContentPaths } from './lib/paths'
import { runPhase, runPhaseSync } from './lib/phase'
import handleMacros from './macros/index'
import { type IDocumentConfig, type IDocumentPage, type IModuleBuilderConfig, MetadataUseKeys } from './types'

const convertMarkdownToHtml = async (
  filePath: string,
  mdRenderer: ReturnType<typeof getMarkdownRenderer>,
  config: IDocumentConfig,
): Promise<IDocumentPage> => {
  const content = await runPhase(`read markdown`, () => fs.readFile(filePath, 'utf8'))

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
    metadata: {
      ...config,
      ...frontMatter.data,
    },
    content: htmlContent,
  }
}

export const applyTemplate = async (page: IDocumentPage, templatePath: string): Promise<string> => {
  const { content, metadata } = page
  const template = await runPhase(`read template`, () => fs.readFile(templatePath, 'utf8'))

  let res = template
    .replace('{{header}}', metadata.header ?? '')
    .replace('{{footer}}', metadata.footer ?? '')
    .replace('{{content}}', content)

  if (Array.isArray(metadata.use)) {
    if (metadata.use.includes(MetadataUseKeys.version)) {
      res = res.replace('{{version}}', getConsumingAppVersion(page.metadata))
    }
    if (metadata.use.includes(MetadataUseKeys.documentTitle)) {
      res = res.replace('{{documentTitle}}', metadata.documentTitle ?? '')
    }
    if (metadata.use.includes(MetadataUseKeys.buildMode)) {
      res = res.replace('{{buildMode}}', metadata.isProduction ? '' : (metadata.draftWatermarkHtml ?? ''))
    }
  }

  if (metadata.name) {
    res = res.replace('data-id-placeholder', `id="${metadata.name}" data-id="${metadata.name}"`)
  }
  if (metadata['picture-id']) {
    res = res.replace('{{pictureId}}', metadata['picture-id'] as string)
  }

  res = res.replace(/\{\{\s*((?:[a-zA-Z-]+\s*=\s*"[^"]*"\s*)+)\}\}/g, (_, values: string) => {
    const translations = Object.fromEntries(
      [...values.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)].map(([, locale, value]) => [locale, value]),
    )

    const lang = process.env.OB_LANG
    if (!lang) {
      throw new Error('Language is not set')
    }

    if (!(lang in translations)) {
      throw new Error(`Missing translation for locale "${lang}"`)
    }

    return translations[lang]
  })

  return res
}

export const copyHtmlBuildAssets = async (config: IModuleBuilderConfig): Promise<void> => {
  const htmlBuildDir = getHtmlBuildPath(config)
  const cssPath = getCssPath(config)

  if (!fs.existsSync(htmlBuildDir)) {
    fs.mkdirSync(htmlBuildDir, { recursive: true })
  }

  await runPhase('copy static assets into chunks-html', async () => {
    await Promise.all([
      fs.copy(cssPath, path.join(htmlBuildDir, 'output.css')),
      fs.copy(path.join(OKTOZINE_ROOT, 'webviewer/index.html'), path.join(htmlBuildDir, 'server.html')),
      fs.copy(resolveContentPaths(config).imagesDir, path.join(htmlBuildDir, 'images/')),
      fs.copy(resolveContentPaths(config).fontsDir, path.join(htmlBuildDir, 'fonts/')),
    ])
  })
}

const shouldRebuildAllFiles = (
  markdownSrcDir: string,
  markdownFiles: string[],
  { id, invalidateBuildOnPattern }: IDocumentConfig,
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

const filterFiles = (config: IDocumentConfig, files: string[]): string[] => {
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

const renderToHtml = async (
  page: IDocumentPage,
  buildDir: string,
  fileName: string,
  templatesDir: string,
): Promise<void> => {
  const { metadata } = page
  const { template, seqPage, seqPageNum } = metadata

  if (!metadata.template) {
    throw new Error(`Missing "template" in front-matter for ${fileName}`)
  }

  if (seqPage) {
    fileName = fileName.replace('.md', `-${seqPageNum}.md`)
  }

  const templatePath = path.join(templatesDir, template!)
  const html = await applyTemplate(page, templatePath)

  const outPath = path.join(buildDir, `${fileName}.html`)
  await runPhase(`write html ${outPath}`, () => fs.writeFile(outPath, html))

  logger.info(chalk.cyan(`>> Generated HTML for ${fileName}`))
}

export const buildHtml = async (config: IDocumentConfig): Promise<void> => {
  logger.info(chalk.cyan(`Building HTML for "${config.documentTitle}" (${config.documentFileName})...`))
  const endBuildHtmlMeasure = measure()

  if (config.includePattern && config.include) {
    logger.error(chalk.red('Config error: includePattern + include will not work'))

    return
  }

  const { markdownPath, templatesDir } = resolveContentPaths(config)
  const htmlBuildPath = getHtmlModuleBuildPath(config)
  const markdownRenderer = getMarkdownRenderer()

  await runPhase(`ensureDir ${htmlBuildPath}`, () => fs.ensureDir(htmlBuildPath))
  let markdownFiles = await runPhase(`readdir ${markdownPath}`, () => fs.readdir(markdownPath))

  const forceRebuildAll = shouldRebuildAllFiles(markdownPath, markdownFiles, config)
  markdownFiles = filterFiles(config, markdownFiles)

  if (config.shouldRebuildHtml) {
    logger.info(chalk.cyan('>> All HTML files to rebuild'))
  }

  const isHtmlBuilt = (file: string): boolean => {
    const outPath = path.join(htmlBuildPath, `${file}.html`)

    return runPhaseSync(`pathExistsSync ${outPath}`, () => fs.pathExistsSync(outPath))
  }

  const buildFilePath = getBuildFilePath(config.id)

  /* THROUGH THE MATCHED FILES */
  const processes = markdownFiles.map(async (fileName) => {
    try {
      if (!fileName.endsWith('.md')) {
        logger.debug(`>> Skipped ${fileName}, no .md extension`)

        return null
      }

      const filePath = path.join(markdownPath, fileName)

      if (!config.shouldRebuildHtml) {
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

      return Promise.all(
        pagesData.map(async (pageData) => renderToHtml(pageData, htmlBuildPath, fileName, templatesDir)),
      )
    } catch (err) {
      // Add per-file context so Promise.all surfaces a helpful label.
      throw new Error(`HTML generation failed for source "${fileName}" (document "${config.id}")`, { cause: err })
    }
  })

  await runPhase(`Promise.all(html generation) for document "${config.id}"`, () => Promise.all(processes))

  try {
    updateLastBuildTime(buildFilePath)
  } catch (err) {
    throw new Error(`updateLastBuildTime failed (${buildFilePath})`, { cause: err })
  }

  const buildHtmlMeasure = endBuildHtmlMeasure()
  logger.info(chalk.cyan(`>> HTML build ended in ${buildHtmlMeasure}`))
}
