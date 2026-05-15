#!/usr/bin/env tsx

import chalk from 'chalk'
import deepmerge from 'deepmerge'

import { buildHtml, copyHtmlBuildAssets } from './build-html'
import { buildPdf } from './build-pdf'
import { parseScriptArgs, printUsage } from './lib/commandLine'
import { loadBuildConfig, validateConfigVersion } from './lib/config'
import { logger } from './lib/logger'
import { measure } from './lib/measure'
import { runPhase } from './lib/phase'
import { IDocumentConfig } from './types'

export const main = async (): Promise<void> => {
  const moduleOptions = parseScriptArgs()
  const { documentIds, useHelp, logLevel, isParallel, configPath } = moduleOptions

  if (useHelp) {
    return printUsage()
  }

  // FIXME to config
  if (logLevel) {
    process.env.LOG_LEVEL = logLevel
    logger.level = logLevel
  }

  const endMeasure = measure()

  const buildConfig = await runPhase(`Failed to load build config${configPath ? ` (${configPath})` : ''}`, () =>
    loadBuildConfig(moduleOptions, configPath),
  )

  validateConfigVersion(buildConfig)
  let requestedIds = documentIds

  // If no document ID set, collect all
  if (!requestedIds.length) {
    requestedIds = buildConfig.documents.filter((p) => !p.skipBuild).map((p) => p.id)
  }

  logger.info(chalk.yellow(`Building: ${requestedIds.join(', ')}`))
  const { documents, ...defaults } = buildConfig

  const docsToBuild = documents.filter((p) => requestedIds.includes(p.id))
  const missingIds = requestedIds.filter((id) => !documents.some((p) => p.id === id))
  if (missingIds.length) {
    logger.error(chalk.red(`Error: no document(s) found for id(s): ${missingIds.join(', ')}`))
    process.exit(1)
  }

  await runPhase('prepareHtmlBuild() failed', () => copyHtmlBuildAssets(buildConfig))

  // Serial HTML build (avoid clobbering overlapping files)
  for (const conf of docsToBuild) {
    const merged = deepmerge(defaults, conf)
    await runPhase(`buildHtml() failed for document "${conf.id}"`, () => buildHtml(merged))
  }

  // PDF build — serial by default, parallel with --parallel flag
  await runPhase('buildPdf() failed (one or more documents)', async () => {
    if (isParallel) {
      await Promise.all(
        docsToBuild.map(async (conf: IDocumentConfig) => {
          const merged = deepmerge(defaults, conf)
          await runPhase(`buildPdf() failed for document "${conf.id}"`, () => buildPdf(merged))
        }),
      )
    } else {
      for (const conf of docsToBuild) {
        const merged = deepmerge(defaults, conf)
        await runPhase(`buildPdf() failed for document "${conf.id}"`, () => buildPdf(merged))
      }
    }
  })

  const measuredBuildTime = endMeasure()
  logger.info(chalk.yellow(`Build ended in ${measuredBuildTime}`))
}

void main()
