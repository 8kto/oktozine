import packageConfig from '../../../package.json' with { type: 'json' }
import { IDocumentConfig } from '../types'

export const getBuildFileVersion = (config: IDocumentConfig): string => {
  const sfx = config.isProduction ? '' : '-dev'

  return `v${packageConfig.version}${sfx}`
}
