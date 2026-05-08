import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { IPartProperties } from '../types'

// Absolute path to the repository root (the directory that contains package.json,
// src/, scripts/, etc.). Resolved once from this file's known location.
//
// When this pipeline is extracted as a standalone library, callers should supply
// the project root via config rather than relying on this module-level constant.
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

export const OKTOZINE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const DEFAULT_BUILD_PATH = path.join(PROJECT_ROOT, 'build')

export const getHtmlBuildPath = <T extends IPartProperties>(config: T) => {
  return path.join(config.outputPath, 'chunks-html')
}

export const getHtmlModuleBuildPath = (config: IPartProperties) => {
  return path.join(getHtmlBuildPath(config), `module-${config.id}`)
}

export const getPdfBuildPath = (config: IPartProperties) => {
  return path.join(config.outputPath, 'pdf', `module-${config.id}`)
}

export const getCssPath = (config: IPartProperties) => {
  return path.join(config.outputPath, 'output.css')
}

export const getReleasePath = (config: IPartProperties) => {
  return path.join(config.outputPath, 'release')
}
