import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * @param {string} cliPath
 * @returns {Promise<ModuleBuilderConfig>}
 */
export const loadBuildConfig = async (cliPath) => {
  const importConfig = async (absPath) => {
    const mod = await import(pathToFileURL(absPath).href)
    return Object.prototype.hasOwnProperty.call(mod, 'default') ? mod.default : mod
  }

  if (cliPath) {
    const abs = resolve(process.cwd(), cliPath)
    return importConfig(abs)
  }

  const root = process.cwd()
  const candidates = [
    resolve(root, 'oktozin.build.conf.mjs'),
    resolve(root, 'oktozin.build.conf.js'),
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
