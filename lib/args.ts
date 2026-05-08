import path from 'node:path'

import chalk from 'chalk'

import { BuildModuleOptions } from '../types'
import { logger } from './logger'

const USAGE = `
Usage: tsx scripts/oktozine/build-module.ts <partIds> [options]

<partIds>                           Comma-separated list of part IDs to build (positional)
-h, --help                          Show this help and exit
-x, --html-no-skip, no-html-skip    Rebuild every HTML file, skipping the cache
--parallel                          Build PDFs in parallel (default: serial)
--production                        Build PDFs in parallel (default: serial)
--skip-bookmarks                    Skip adding PDF bookmarks (default: adds)
--log-level <level>                 Set pino logger level (trace|debug|info|warn|error|fatal)
--config <path>                     Path to build config file (e.g. ./conf/build.conf.ts)
--output-dir <path>                 Base output directory (default: <project-root>/build); final PDFs go into <path>/release/
`.trim()

export const parseScriptArgs = (): BuildModuleOptions => {
  const args = process.argv.slice(2)
  const options: BuildModuleOptions = {
    partIds: [],
    help: false,
    htmlNoSkip: false,
    parallel: false,
    addBookmarks: true,
    production: false,
  }

  let i = 0
  while (i < args.length) {
    const arg = args[i]

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true
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
        options.htmlNoSkip = true
        i += 1
        break

      case '--parallel':
        options.parallel = true
        i += 1
        break

      case '--skip-bookmarks':
        options.addBookmarks = false
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
        options.outputDir = path.resolve(val)
        i += 2
        break
      }

      default:
        if (arg.startsWith('-')) {
          logger.error(chalk.red(`Error: unknown option ${arg}`))
          process.exit(1)
        }

        if (options.partIds.length === 0) {
          options.partIds = arg
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

  return options
}

export const printUsage = () => {
  // eslint-disable-next-line no-console
  console.log(USAGE)
}
