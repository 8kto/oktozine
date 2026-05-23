import fs, { existsSync } from 'node:fs'
import path, { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import oktozinePackage from '../../package.json' with { type: 'json' }
import type { BuildModuleOptions, IDocumentConfig, IModuleBuilderConfig } from '../types'
import { DEFAULT_BUILD_PATH } from './paths'

type ConsumingAppPackageJson = {
  name?: string
  version?: string
  [key: string]: unknown
}

export function getConsumingAppPackageJson(start = process.cwd()): ConsumingAppPackageJson {
  const appRoot = findAppRoot(start)
  const pkgPath = resolve(appRoot, 'package.json')

  if (!existsSync(pkgPath)) {
    throw new Error(`Cannot find consuming app package.json in ${appRoot}`)
  }

  return JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as ConsumingAppPackageJson
}

export const getConsumingAppVersion = (config: IDocumentConfig): string => {
  const consumingAppConfig = getConsumingAppPackageJson()
  const sfx = config.isProduction ? '' : '-dev'

  return `v${consumingAppConfig.version}${sfx}`
}

const enrichConfigWithModuleOptions = <T extends IModuleBuilderConfig>(
  conf: T,
  moduleOptions: BuildModuleOptions,
): T => {
  return {
    ...conf,
    isProduction: !!moduleOptions.isProduction,
    outputPath: moduleOptions.outputPath ?? DEFAULT_BUILD_PATH,
    useHtmlRebuild: !!moduleOptions.useHtmlRebuild,
    usePdfBookmarks: !!moduleOptions.usePdfBookmarks,
  }
}

const importConfig = async (absPath: string): Promise<IModuleBuilderConfig> => {
  const mod = await import(pathToFileURL(absPath).href)

  return Object.prototype.hasOwnProperty.call(mod, 'default')
    ? (mod as { default: IModuleBuilderConfig }).default
    : (mod as IModuleBuilderConfig)
}

export const findAppRoot = (start: string): string => {
  const current = path.resolve(start)
  const parts = current.split(path.sep)
  const nmIdx = parts.lastIndexOf('node_modules')

  if (nmIdx === -1) {
    return current
  }

  const root = parts.slice(0, nmIdx).join(path.sep)

  return root || path.parse(current).root
}

export async function loadBuildConfig(moduleOptions: BuildModuleOptions, cliPath?: string) {
  if (cliPath) {
    const absPath = resolve(process.cwd(), cliPath)
    const conf = await importConfig(absPath)

    return enrichConfigWithModuleOptions(conf, moduleOptions)
  }

  const appRoot = findAppRoot(process.cwd())

  const candidates = [
    resolve(appRoot, 'oktozine.build.conf.mjs'),
    resolve(appRoot, 'oktozine.build.conf.js'),
    resolve(appRoot, 'conf/oktozine.build.conf.mjs'),
    resolve(appRoot, 'conf/oktozine.build.conf.js'),
  ]

  for (const p of candidates) {
    if (!existsSync(p)) {
      continue
    }

    const conf = await importConfig(p)

    return enrichConfigWithModuleOptions(conf, moduleOptions)
  }

  throw new Error(`oktozine config not found in ${appRoot}`)
}

export const validateConfigVersion = (buildConfig: IModuleBuilderConfig) => {
  const MIN_CONFIG_VERSION = oktozinePackage.version

  const [major, minor] = buildConfig.version.split('.').map(Number)
  const [minMajor, minMinor] = MIN_CONFIG_VERSION.split('.').map(Number)
  const tooOld = major < minMajor || (major === minMajor && minor < minMinor)
  if (tooOld || major > minMajor) {
    throw new Error(
      `Config version "${buildConfig.version}" is out of supported range [${MIN_CONFIG_VERSION}, ${minMajor + 1}.x].`,
    )
  }
}
