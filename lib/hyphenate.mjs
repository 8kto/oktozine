/* eslint-env browser */
import russian from 'hyphenation.ru'
import Hypher from 'hypher'
import { JSDOM } from 'jsdom'

/**
 * Расставляет мягкие переносы (&shy; / \u00AD) в текстовых узлах HTML-фрагмента.
 * Подходит для последующей печати в PDF через Puppeteer/Chrome.
 *
 * @param {string} htmlFragment - HTML-фрагмент (строка), НЕ полный документ.
 * @param {object} [opts]
 * @param {number} [opts.minWordLength=5] - Минимальная длина слова для переносов.
 * @param {string[]} [opts.skipTags] - Теги, внутри которых текст не трогаем.
 * @param {boolean} [opts.preserveExisting=true] - Сохранять уже имеющиеся мягкие переносы.
 * @returns {string} Обработанный HTML-фрагмент со вставленными мягкими переносами.
 */
export const hyphenateHtml = (htmlFragment, opts = {}) => {
  const {
    minWordLength = 7,
    skipTags = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'KBD', 'SAMP', 'NOSCRIPT', 'EM', 'I', 'B', 'STRONG'],
    preserveExisting = true,
  } = opts

  // Оборачиваем фрагмент в контейнер, чтобы удобно сериализовать innerHTML
  const dom = new JSDOM(`<div id="__root__">${htmlFragment}</div>`)
  const root = dom.window.document.getElementById('__root__')

  // Инициализируем русские правила переносов
  const h = new Hypher({ ...russian, leftmin: 4, rightmin: 3 })
  const SOFT = '\u00AD'

  // Регулярка для слов: только буквенные, длиной >= minWordLength (Unicode)
  // Исключаем слова с цифрами/URL-символами, чтобы не ломать ссылки/почту/имена переменных.
  const WORD_RE = new RegExp(`\\p{L}{${minWordLength},}`, 'gu')

  const URL_LIKE_RE = /[:/@._#?=0-9%\\-]/ // если внутри токена встречаются такие символы — пропускаем

  /**
   * Обработка текстового узла: расставляем мягкие переносы по правилам Hypher
   * @param {HTMLElement} node
   */
  const hyphenateTextNode = (node) => {
    // Быстрые прогоны: пустые / пробельные узлы не трогаем
    const text = node.nodeValue
    if (!text || !text.trim()) {
      return
    }

    let changed = false

    const replaced = text.replace(WORD_RE, (word) => {
      // Пропуск, если уже есть мягкие переносы и мы должны их сохранить
      if (preserveExisting && word.includes(SOFT)) {
        return word
      }

      // Пропуск URL-/email-подобных и слов с цифрами/служебными символами
      if (URL_LIKE_RE.test(word)) {
        return word
      }

      // Hypher вернёт массив слогов; если переносов нет, вернётся исходное слово
      const parts = h.hyphenate(word)
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

  /**
   * Обход DOM: только текстовые узлы и допустимые элементы
   * @param {HTMLElement} node
   */
  const walk = (node) => {
    const { Node } = dom.window

    if (node.nodeType === Node.TEXT_NODE) {
      hyphenateTextNode(node)

      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return
    }

    if (skipTags.includes(node.nodeName)) {
      return
    } // пропускаем запрещённые контейнеры

    // Не углубляемся в скрытые по типу <script> и др. уже отсечены; остальные — обходим
    for (const child of node.childNodes) {
      walk(child)
    }
  }

  walk(root)

  return root.innerHTML
}

/* -------------------------
   Пример использования:

import { readFileSync, writeFileSync } from 'node:fs';
import { hyphenateHtml } from './hyphenate-html.js';

const src = readFileSync('fragment.html', 'utf8');
const out = hyphenateHtml(src, {
  minWordLength: 5,
  skipTags: ['SCRIPT','STYLE','CODE','PRE','KBD','SAMP','NOSCRIPT'],
});
writeFileSync('fragment.hyph.html', out, 'utf8');

Далее печатаем fragment.hyph.html через Puppeteer.
-------------------------- */
