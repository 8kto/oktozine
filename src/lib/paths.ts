import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { IBaseConfig, IDocumentConfig } from '../types'

export const OKTOZINE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// FIXME consistent names
export interface IResolvedContentPaths {
  projectRoot: string
  markdownPath: string
  templatesDir: string
  imagesDir: string
  fontsDir: string
  pageNumbersFontPath: string
}

/**
 * TODO oktozine root?
 */
export const resolveContentPaths = (
  config: Pick<
    IBaseConfig,
    'projectRoot' | 'markdownPath' | 'templatesDir' | 'imagesDir' | 'fontsDir' | 'pageNumbersFontPath'
  >,
): IResolvedContentPaths => {
  const root = config.projectRoot ?? process.cwd()
  const fonts = config.fontsDir ?? path.join(root, 'src/styles/fonts')

  return {
    projectRoot: root,
    markdownPath: config.markdownPath ?? path.join(root, 'src/markdown'),
    templatesDir: config.templatesDir ?? path.join(root, 'src/html'),
    imagesDir: config.imagesDir ?? path.join(root, 'src/images'),
    fontsDir: fonts,
    pageNumbersFontPath: config.pageNumbersFontPath ?? path.join(fonts, 'Philosopher/Philosopher-Regular.ttf'),
  }
}

// FIXME use consuming app path
// TODO integrate into resolveContentPaths
export const DEFAULT_BUILD_PATH = path.join(process.cwd(), 'build')
export const DEFAULT_RELEASE_PATH = path.join(DEFAULT_BUILD_PATH, 'release')

export const getHtmlBuildPath = <T extends { outputPath: string }>(config: T) => {
  return path.join(config.outputPath, 'chunks-html')
}

export const getHtmlModuleBuildPath = (config: IDocumentConfig) => {
  return path.join(getHtmlBuildPath(config), `module-${config.id}`)
}

export const getPdfBuildPath = (config: IDocumentConfig) => {
  return path.join(config.outputPath, 'pdf', `module-${config.id}`)
}

// TODO integrate into resolveContentPaths
export const getCssPath = <T extends { outputPath: string; cssPath?: string }>(config: T) => {
  return config.cssPath ?? path.join(config.outputPath, 'output.css')
}

export const getReleasePath = (config: IDocumentConfig) => {
  return config.releasePath ?? path.join(config.outputPath, 'release')
}
