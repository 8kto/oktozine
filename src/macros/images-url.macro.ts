import type { IDocumentConfig } from '../types'

/**
 * Replaces every `{{imagesSrc}}` placeholder in the Markdown source with the
 * resolved images base URL: `http://localhost:<webServerPort>/images`.
 * No-op when `webServerPort` is not configured.
 */
export const replaceImagesSrc = (markdown: string, config: IDocumentConfig): string => {
  if (!config.webServerPort) {
    return markdown
  }

  return markdown.replaceAll('{{imagesSrc}}', `http://localhost:${config.webServerPort}/images`)
}
