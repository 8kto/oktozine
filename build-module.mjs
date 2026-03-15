#!/bin/env node

import chalk from 'chalk'
import deepmerge from 'deepmerge'

import { buildHtml, prepareHtmlBuild } from './build-html.mjs'
import { buildPdf } from './build-pdf.mjs'
import { loadBuildConfig } from './lib/build-config-loader.mjs'
import { logger } from './lib/logger.mjs'
import { measure } from './lib/measure.mjs'

/** ---------- CLI parsing -------------------------------------------------- */

const USAGE = `
Usage: ./scripts/oktozine/build-module.mjs <partIds> [options]

<partIds>                           Comma-separated list of part IDs to build (positional)
-h, --help                          Show this help and exit
-x, --html-no-skip, no-html-skip    Rebuild every HTML file, skipping the cache
--log-level <level>                 Set pino logger level (trace|debug|info|warn|error|fatal)
--config <path>                     Path to build config file (e.g. ./conf/build.conf.mjs)
`.trim()

/**
 * Parse CLI arguments.
 * @returns {{ partIds:string[], help:boolean, logLevel?:string, htmlNoSkip:boolean, config?:string }}
 */
const parseArgs = () => {
  const args = process.argv.slice(2)
  const out = { partIds: [], help: false, htmlNoSkip: false }

  let i = 0
  while (i < args.length) {
    const arg = args[i]

    switch (arg) {
      case '-h':
      case '--help':
        out.help = true
        i += 1
        break

      case '--log-level': {
        const val = args[i + 1]
        if (!val || val.startsWith('-')) {
          logger.error(chalk.red('Error: --log-level requires a value'))
          process.exit(1)
        }
        out.logLevel = val
        i += 2
        break
      }

      case '-x':
      case '--html-no-skip':
      case '--no-html-skip':
      case '--no-skip-html':
        out.htmlNoSkip = true
        i += 1
        break

      case '--config': {
        const val = args[i + 1]
        if (!val || val.startsWith('-')) {
          logger.error(chalk.red('Error: --config requires a file path'))
          process.exit(1)
        }
        out.config = val
        i += 2
        break
      }

      default:
        if (arg.startsWith('-')) {
          logger.error(chalk.red(`Error: unknown option ${arg}`))
          process.exit(1)
        }

        if (out.partIds.length === 0) {
          out.partIds = arg
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          i += 1
        } else {
          logger.error(chalk.red('Error: only one positional <partIds> allowed'))
          process.exit(1)
        }
    }
  }

  return out
}

/** ---------- Error formatting --------------------------------------------- */

/**
 * Wrap async phases with contextual error.
 * @template T
 * @param {string} label
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
const runPhase = async (label, fn) => {
  try {
    return await fn()
  } catch (err) {
    // Re-throw anchored here, preserving the original error as cause.
    throw new Error(label, { cause: err })
  }
}

/** ---------------------------- main build --------------------------------- */

export const main = async () => {
  const { partIds, help, logLevel, htmlNoSkip, config: configPath } = parseArgs()

  if (help) {
    // eslint-disable-next-line no-console
    console.log(USAGE)

    return
  }

  if (logLevel) {
    process.env.LOG_LEVEL = logLevel
    logger.level = logLevel
  }
  if (htmlNoSkip) {
    process.env.HTML_NO_SKIP = 'true'
  }

  const endMeasure = measure()

  const buildConfig = await runPhase(`Failed to load build config${configPath ? ` (${configPath})` : ''}`, () =>
    loadBuildConfig(configPath),
  )

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

  await runPhase('prepareHtmlBuild() failed', () => prepareHtmlBuild())

  // Serial HTML build (avoid clobbering overlapping files)
  for (const conf of docsToBuild) {
    const merged = deepmerge(defaults, conf)
    await runPhase(`buildHtml() failed for part "${conf.id}"`, () => buildHtml(merged))
  }

  // Parallel PDF build
  await runPhase('buildPdf() failed (one or more parts)', async () => {
    await Promise.all(
      docsToBuild.map(async (conf) => {
        const merged = deepmerge(defaults, conf)
        await runPhase(`buildPdf() failed for part "${conf.id}"`, () => buildPdf(merged))
      }),
    )
  })

  const measuredBuildTime = endMeasure()
  logger.info(chalk.yellow(`Build ended in ${measuredBuildTime}`))
}

await main()
