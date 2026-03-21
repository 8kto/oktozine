#!/usr/bin/env tsx

import fs from 'fs/promises'
import hyphenopoly from 'hyphenopoly'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const getHyphenator = async (): Promise<(text: string) => string> =>
  await hyphenopoly.config({
    require: ['ru'],
    defaultLanguage: 'ru',
    hyphen: '•',
    loader: async (file: string) => {
      return fs.readFile(path.join(__dirname, '../node_modules/hyphenopoly/patterns', file))
    },
    exceptions: {
      ru: '------',
    },
  })

/**
 * @deprecated Unused
 */
export const hyphenateRu = async (text: string): Promise<string> => {
  const hyphenator = await getHyphenator()

  return hyphenator(text).replaceAll('•', '\u00AD')
}
