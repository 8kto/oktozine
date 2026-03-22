/* eslint-env browser */
import russian from 'hyphenation.ru'
import Hypher from 'hypher'
import { JSDOM } from 'jsdom'

interface IHyphenateOptions {
  minWordLength?: number
  skipTags?: string[]
  preserveExisting?: boolean
}

const hypher = new Hypher({ ...russian, leftmin: 4, rightmin: 3 })

/**
 * Расставляет мягкие переносы (&shy; / \u00AD) в текстовых узлах HTML-фрагмента.
 */
export const hyphenateHtml = (htmlFragment: string, opts: IHyphenateOptions = {}): string => {
  const {
    minWordLength = 7,
    skipTags = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'KBD', 'SAMP', 'NOSCRIPT', 'EM', 'I', 'B', 'STRONG'],
    preserveExisting = true,
  } = opts

  const dom = new JSDOM(`<div id="__root__">${htmlFragment}</div>`)
  const root = dom.window.document.getElementById('__root__')!
  const SOFT = '\u00AD'

  const WORD_RE = new RegExp(`\\p{L}{${minWordLength},}`, 'gu')
  const URL_LIKE_RE = /[:/@._#?=0-9%\\-]/

  const hyphenateTextNode = (node: Text): void => {
    const text = node.nodeValue
    if (!text || !text.trim()) {
      return
    }

    let changed = false

    const replaced = text.replace(WORD_RE, (word) => {
      if (preserveExisting && word.includes(SOFT)) {
        return word
      }
      if (URL_LIKE_RE.test(word)) {
        return word
      }
      const parts = hypher.hyphenate(word)
      if (!parts || parts.length <= 1) {
        return word
      }
      changed = true
      return parts.join(SOFT)
    })

    if (changed) {
      node.nodeValue = replaced
    }
  }

  const walk = (node: Node): void => {
    const { Node } = dom.window

    if (node.nodeType === Node.TEXT_NODE) {
      hyphenateTextNode(node as Text)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return
    }
    if (skipTags.includes((node as Element).nodeName)) {
      return
    }
    for (const child of node.childNodes) {
      walk(child)
    }
  }

  walk(root)

  return root.innerHTML
}
