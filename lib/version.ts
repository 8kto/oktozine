import packageConfig from '../../../package.json' with { type: 'json' }
import { IPartProperties } from '../types'

export const getBuildFileVersion = (_config: IPartProperties): string => {
  // FIXME use config
  const sfx = process.env.BUILD_MODE === 'production' ? '' : '-dev'

  return `v${packageConfig.version}${sfx}`
}
