import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { BuildModuleOptions, IModuleBuilderConfig } from '../types'
import { DEFAULT_BUILD_PATH } from './paths'

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

export const loadBuildConfig = async (
  moduleOptions: BuildModuleOptions,
  cliPath?: string,
): Promise<IModuleBuilderConfig> => {
  const importConfig = async (absPath: string): Promise<IModuleBuilderConfig> => {
    const mod = await import(pathToFileURL(absPath).href)

    return Object.prototype.hasOwnProperty.call(mod, 'default') ? mod.default : mod
  }

  if (cliPath) {
    const absPath = resolve(process.cwd(), cliPath)
    const conf = await importConfig(absPath)

    return enrichConfigWithModuleOptions(conf, moduleOptions)
  }

  // NB should search in the consuming app not in the lib dirs
  const projectRoot = process.cwd()
  const candidates = [
    resolve(projectRoot, 'oktozin.build.conf.ts'),
    resolve(projectRoot, 'oktozin.build.conf.mjs'),
    resolve(projectRoot, 'oktozin.build.conf.js'),
    resolve(projectRoot, 'conf/oktozin.build.conf.ts'),
    resolve(projectRoot, 'conf/oktozin.build.conf.mjs'),
    resolve(projectRoot, 'conf/oktozin.build.conf.js'),
  ]

  for (const p of candidates) {
    try {
      const conf = await importConfig(p)

      return enrichConfigWithModuleOptions(conf, moduleOptions)
    } catch {
      // try next candidate
    }
  }

  throw new Error('No build config provided or found.')
}

export const validateConfigVersion = (buildConfig: IModuleBuilderConfig) => {
  // TODO version should be consumed from the package json when the oktozine is extracted as a lib
  const MIN_CONFIG_VERSION = '2.0.0'

  const [major, minor, patch] = buildConfig.version.split('.').map(Number)
  const [minMajor, minMinor, minPatch] = MIN_CONFIG_VERSION.split('.').map(Number)
  const tooOld =
    major < minMajor ||
    (major === minMajor && minor < minMinor) ||
    (major === minMajor && minor === minMinor && patch < minPatch)
  if (tooOld || major > minMajor) {
    throw new Error(
      `Config version "${buildConfig.version}" is out of supported range [${MIN_CONFIG_VERSION}, ${minMajor + 1}.x].`,
    )
  }
}
