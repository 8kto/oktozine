import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { IModuleBuilderConfig } from '../types'

export const loadBuildConfig = async (cliPath?: string): Promise<IModuleBuilderConfig> => {
  const importConfig = async (absPath: string): Promise<IModuleBuilderConfig> => {
    const mod = await import(pathToFileURL(absPath).href)

    return Object.prototype.hasOwnProperty.call(mod, 'default') ? mod.default : mod
  }

  if (cliPath) {
    const abs = resolve(process.cwd(), cliPath)

    return importConfig(abs)
  }

  const root = process.cwd()
  const candidates = [
    resolve(root, 'oktozin.build.conf.ts'),
    resolve(root, 'oktozin.build.conf.mjs'),
    resolve(root, 'oktozin.build.conf.js'),
    resolve(root, 'conf/oktozin.build.conf.ts'),
    resolve(root, 'conf/oktozin.build.conf.mjs'),
    resolve(root, 'conf/oktozin.build.conf.js'),
  ]

  for (const p of candidates) {
    try {
      return await importConfig(p)
    } catch {
      // try next candidate
    }
  }

  throw new Error('No build config provided or found.')
}
