#!/usr/bin/env tsx

import chalk from 'chalk'
import deepmerge from 'deepmerge'

import { buildHtml, prepareHtmlBuild } from './build-html'
import { buildPdf } from './build-pdf'
import { parseScriptArgs, printUsage } from './lib/args'
import { loadBuildConfig, validateConfigVersion } from './lib/config'
import { logger } from './lib/logger'
import { measure } from './lib/measure'
import { runPhase } from './lib/phase'

export const main = async (): Promise<void> => {
  const moduleOptions = parseScriptArgs()
  const { partIds, help, logLevel, htmlNoSkip, parallel, addBookmarks, configPath, outputDir } = moduleOptions

  if (help) {
    return printUsage()
  }

  // FIXME to config
  if (logLevel) {
    process.env.LOG_LEVEL = logLevel
    logger.level = logLevel
  }
  if (htmlNoSkip) {
    process.env.HTML_NO_SKIP = 'true'
  }

  const endMeasure = measure()

  const buildConfig = await runPhase(`Failed to load build config${configPath ? ` (${configPath})` : ''}`, () =>
    loadBuildConfig(moduleOptions, configPath),
  )

  validateConfigVersion(buildConfig)
  let requestedIds = partIds
  if (!requestedIds.length) {
    requestedIds = buildConfig.parts.filter((p) => !p.skipBuild).map((p) => p.id)
  }

  logger.info(chalk.yellow(`Building: ${requestedIds.join(', ')}`))
  const { parts, ...defaults } = buildConfig

  const docsToBuild = parts.filter((p) => requestedIds.includes(p.id))
  const missingIds = requestedIds.filter((id) => !parts.some((p) => p.id === id))
  if (missingIds.length) {
    logger.error(chalk.red(`Error: no part(s) found for id(s): ${missingIds.join(', ')}`))
    process.exit(1)
  }

  await runPhase('prepareHtmlBuild() failed', () => prepareHtmlBuild(outputDir))

  // Serial HTML build (avoid clobbering overlapping files)
  for (const conf of docsToBuild) {
    const merged = deepmerge(defaults, conf)
    await runPhase(`buildHtml() failed for part "${conf.id}"`, () => buildHtml(merged, outputDir))
  }

  // PDF build — serial by default, parallel with --parallel flag
  await runPhase('buildPdf() failed (one or more parts)', async () => {
    if (parallel) {
      await Promise.all(
        docsToBuild.map(async (conf) => {
          const merged = deepmerge(defaults, conf)
          await runPhase(`buildPdf() failed for part "${conf.id}"`, () => buildPdf(merged, outputDir, addBookmarks))
        }),
      )
    } else {
      for (const conf of docsToBuild) {
        const merged = deepmerge(defaults, conf)
        await runPhase(`buildPdf() failed for part "${conf.id}"`, () => buildPdf(merged, outputDir, addBookmarks))
      }
    }
  })

  const measuredBuildTime = endMeasure()
  logger.info(chalk.yellow(`Build ended in ${measuredBuildTime}`))
}

void main()
