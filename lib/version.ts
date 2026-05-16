import { createRequire } from 'node:module'

import { IDocumentConfig } from '../types'

const _require = createRequire(import.meta.url)
const packageConfig: { version: string } = _require('../package.json')

export const getBuildFileVersion = (config: IDocumentConfig): string => {
  const sfx = config.isProduction ? '' : '-dev'

  return `v${packageConfig.version}${sfx}`
}
