import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

import type { BuildModuleOptions, IModuleBuilderConfig } from '../../types'
import { loadBuildConfig, validateConfigVersion } from '../config'

const _require = createRequire(import.meta.url)
const pkg = _require('../../../package.json') as { version: string }

const makeConf = (version: string): IModuleBuilderConfig => ({
  version,
  outputPath: '/tmp',
  shouldRebuildHtml: false,
  documents: [],
})

describe('validateConfigVersion', () => {
  it('throws when config version is older than package version', () => {
    expect(() => validateConfigVersion(makeConf('0.0.1'))).toThrow(/out of supported range/)
  })

  it('accepts config version equal to package.json version', () => {
    expect(() => validateConfigVersion(makeConf(pkg.version))).not.toThrow()
  })

  it('throws when config version is from the next major series', () => {
    const [major] = pkg.version.split('.').map(Number)
    expect(() => validateConfigVersion(makeConf(`${major + 1}.0.0`))).toThrow(/out of supported range/)
  })
})

describe('loadBuildConfig markdownPath precedence', () => {
  const writeConf = (conf: object): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oktozine-conf-'))
    const file = path.join(dir, 'oktozine.build.conf.mjs')
    fs.writeFileSync(file, `export default ${JSON.stringify(conf)}`)

    return file
  }

  const conf = {
    version: pkg.version,
    markdownPath: 'src/markdown/common',
    documents: [{ id: 'player', markdownPath: 'src/markdown/player-book' }, { id: 'referee' }],
  }

  it('keeps top-level and per-document markdownPath when no CLI override', async () => {
    const loaded = await loadBuildConfig({} as BuildModuleOptions, writeConf(conf))
    expect(loaded.markdownPath).toBe('src/markdown/common')
    expect(loaded.documents.map((d) => d.markdownPath)).toEqual(['src/markdown/player-book', undefined])
  })

  it('applies --markdown-dir to every document', async () => {
    const loaded = await loadBuildConfig({ markdownPath: '/cli/md' } as BuildModuleOptions, writeConf(conf))
    expect(loaded.markdownPath).toBe('/cli/md')
    expect(loaded.documents.map((d) => d.markdownPath)).toEqual(['/cli/md', '/cli/md'])
  })
})
