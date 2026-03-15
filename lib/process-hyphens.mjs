#!/usr/bin/env node

import fs from 'fs/promises'
import hyphenopoly from 'hyphenopoly'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * @returns {Promise<any | Map<any, any>>}
 */
const getHyphenator = async () =>
  await hyphenopoly.config({
    require: ['ru'],
    defaultLanguage: 'ru',
    hyphen: '•',
    loader: async (file) => {
      return fs.readFile(path.join(__dirname, '../node_modules/hyphenopoly/patterns', file))
    },
    exceptions: {
      ru: '------',
    },
  })

/**
 * @deprecated Unused
 * @param {string} text
 * @returns {Promise<string>}
 */
export const hyphenateRu = async (text) => {
  const hyphenator = await getHyphenator()

  // It inserts just one character
  return hyphenator(text).replaceAll('•', '\u00AD')
}
