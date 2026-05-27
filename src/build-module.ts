import chalk from 'chalk'
import deepmerge from 'deepmerge'

import { buildHtml, copyHtmlBuildAssets } from './build-html'
import { buildPdf } from './build-pdf'
import { parseScriptArgs, printUsage } from './lib/commandLine'
import { loadBuildConfig, validateConfigVersion } from './lib/config'
import { logger, setLogLevel } from './lib/logger'
import { measure } from './lib/measure'
import { getHtmlBuildPath } from './lib/paths'
import { runPhase } from './lib/phase'
import { type ServerHandle, spawnServerDaemon, startStaticServer, stopServerDaemon, stopStaticServer } from './lib/web-server'
import { IDocumentConfig } from './types'

export const main = async (): Promise<void> => {
  const moduleOptions = parseScriptArgs()
  const { documentIds, useHelp, logLevel, isParallel, configPath, serverCommand } = moduleOptions

  if (useHelp) {
    return printUsage()
  }

  if (logLevel) {
    setLogLevel(logLevel)
  }

  const buildConfig = await runPhase(`Failed to load build config${configPath ? ` (${configPath})` : ''}`, () =>
    loadBuildConfig(moduleOptions, configPath),
  )

  validateConfigVersion(buildConfig)

  // Handle `oktozine server start/stop` sub-commands
  if (serverCommand) {
    const port = moduleOptions.serverPort ?? buildConfig.webServerPort
    if (!port) {
      logger.error(chalk.red('Error: no port configured — set webServerPort in config or pass --port'))
      process.exit(1)
    }
    if (serverCommand === 'start') {
      await spawnServerDaemon(getHtmlBuildPath(buildConfig as { outputPath: string }), port)
    } else {
      stopServerDaemon(port)
    }

    return
  }

  const endMeasure = measure()

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

  // Start static file server for image serving (if configured)
  let webServer: ServerHandle | null = null
  if (buildConfig.webServerPort) {
    const serveDir = getHtmlBuildPath(buildConfig as { outputPath: string })
    if (buildConfig.keepWebServer) {
      // Daemon: parent exits normally; server keeps running in background
      await spawnServerDaemon(serveDir, buildConfig.webServerPort)
    } else {
      webServer = await startStaticServer(serveDir, buildConfig.webServerPort)
    }
  }

  // PDF build — serial by default, parallel with --parallel flag
  try {
    await runPhase('buildPdf() failed (one or more documents)', async () => {
      if (isParallel) {
        await Promise.all(
          docsToBuild.map(async (conf: IDocumentConfig) => {
            const endBuildDocMeasure = measure()

            const merged = deepmerge(defaults, conf)
            await runPhase(`buildPdf() failed for document "${conf.id}"`, () => buildPdf(merged))

            const measuredBuildTime = endBuildDocMeasure()
            logger.info(chalk.yellow(`[${conf.id}] build ended in ${measuredBuildTime}`))
          }),
        )
      } else {
        for (const conf of docsToBuild) {
          const endBuildDocMeasure = measure()

          const merged = deepmerge(defaults, conf)
          await runPhase(`buildPdf() failed for document "${conf.id}"`, () => buildPdf(merged))
        
          const measuredBuildTime = endBuildDocMeasure()
          logger.info(chalk.yellow(`[${conf.id}] build ended in ${measuredBuildTime}`))
        }
      }
    })
  } finally {
    stopStaticServer(webServer)
  }

  const measuredBuildTime = endMeasure()
  logger.info(chalk.yellow(`Build ended in ${measuredBuildTime}`))
}

void main()
