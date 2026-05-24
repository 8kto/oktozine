import path from 'node:path'

import chalk from 'chalk'

import { BuildModuleOptions } from '../types'
import { logger } from './logger'

const USAGE = `
Usage: oktozine <document IDs> [options]
       oktozine server start [--port <port>] [--config <path>]
       oktozine server stop  [--port <port>] [--config <path>]

<document IDs>                      Comma-separated list of document IDs to build (positional)
-h, --help                          Show this help and exit
-x, --html-no-skip, no-html-skip    Rebuild every HTML file, skipping the cache
--parallel                          Build PDFs in parallel (default: serial)
--production                        Build PDFs in production mode (no -dev suffixes etc., default: false)
--skip-bookmarks                    Skip adding PDF bookmarks (default: adds)
--log-level <level>                 Set pino logger level (trace|debug|info|warn|error|fatal)
--config <path>                     Path to build config file (e.g. ./conf/oktozine.build.conf.mjs)
--output-dir <path>                 Base output directory (default: <project-root>/build); final PDFs go into <path>/release/
--port <port>                       Port for server sub-commands (overrides config webServerPort)
`.trim()

export const parseScriptArgs = (): BuildModuleOptions => {
  const args = process.argv.slice(2)
  const options: BuildModuleOptions = {
    documentIds: [],
    isParallel: false,
    isProduction: false,
    useHelp: false,
    useHtmlRebuild: false,
    usePdfBookmarks: true,
  }

  // Handle `server start` / `server stop` sub-commands before the general loop
  if (args[0] === 'server' && (args[1] === 'start' || args[1] === 'stop')) {
    options.serverCommand = args[1] as 'start' | 'stop'
    // Remove the two sub-command tokens; remaining flags are parsed below
    args.splice(0, 2)
  }

  let i = 0
  while (i < args.length) {
    const arg = args[i]

    switch (arg) {
      case '-h':
      case '--help':
        options.useHelp = true
        i += 1
        break

      case '--log-level': {
        const val = args[i + 1]
        if (!val || val.startsWith('-')) {
          logger.error(chalk.red('Error: --log-level requires a value'))
          process.exit(1)
        }
        options.logLevel = val
        i += 2
        break
      }

      case '-x':
      case '--html-no-skip':
      case '--no-html-skip':
      case '--no-skip-html':
        options.useHtmlRebuild = true
        i += 1
        break

      case '--parallel':
        options.isParallel = true
        i += 1
        break

      case '--production':
        options.isProduction = true
        i += 1
        break

      case '--skip-bookmarks':
        options.usePdfBookmarks = false
        i += 1
        break

      case '--config': {
        const val = args[i + 1]
        if (!val || val.startsWith('-')) {
          logger.error(chalk.red('Error: --config requires a file path'))
          process.exit(1)
        }
        options.configPath = val
        i += 2
        break
      }

      case '--output-dir': {
        const val = args[i + 1]
        if (!val || val.startsWith('-')) {
          logger.error(chalk.red('Error: --output-dir requires a path'))
          process.exit(1)
        }
        options.outputPath = path.resolve(val)
        i += 2
        break
      }

      case '--port': {
        const val = args[i + 1]
        if (!val || val.startsWith('-')) {
          logger.error(chalk.red('Error: --port requires a port number'))
          process.exit(1)
        }
        const num = Number(val)
        if (!Number.isInteger(num) || num < 1 || num > 65535) {
          logger.error(chalk.red('Error: --port must be a valid port number (1–65535)'))
          process.exit(1)
        }
        options.serverPort = num
        i += 2
        break
      }

      default:
        if (arg.startsWith('-')) {
          logger.error(chalk.red(`Error: unknown option ${arg}`))
          process.exit(1)
        }

        if (options.documentIds.length === 0) {
          options.documentIds = arg
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          i += 1
        } else {
          logger.error(chalk.red('Error: only one positional <documentIds> allowed'))
          process.exit(1)
        }
    }
  }

  return options
}

export const printUsage = () => {
  // eslint-disable-next-line no-console
  console.log(USAGE)
}
