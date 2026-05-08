import packageConfig from '../../../package.json' with { type: 'json' }
import { IPartProperties } from '../types'

export const getBuildFileVersion = (config: IPartProperties): string => {
  const sfx = config.isProduction ? '' : '-dev'

  return `v${packageConfig.version}${sfx}`
}
