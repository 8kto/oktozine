import { createRequire } from 'node:module'

import type { IModuleBuilderConfig } from '../../types'
import { validateConfigVersion } from '../config'

const _require = createRequire(import.meta.url)
const pkg = _require('../../../package.json') as { version: string }

const makeConf = (version: string): IModuleBuilderConfig => ({
  version,
  outputPath: '/tmp',
  useHtmlRebuild: false,
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
