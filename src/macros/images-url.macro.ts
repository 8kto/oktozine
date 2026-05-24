import type { IDocumentConfig } from '../types'

/**
 * Replaces every `{{imagesUrl}}` placeholder in the Markdown source with the
 * value of `config.imagesUrl`. When `imagesUrl` is not set, the source is
 * returned unchanged.
 */
export const replaceImagesUrl = (markdown: string, config: IDocumentConfig): string => {
  if (!config.imagesUrl) {
    return markdown
  }

  return markdown.replaceAll('{{imagesUrl}}', config.imagesUrl)
}
