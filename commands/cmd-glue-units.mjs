#!/usr/bin/env node

/**
 * @file Add non-breakable spaces between numbers and units like `100 gm` etc.
 */

const UNITS = ['мм', 'см', 'зм', 'фунтов']
const combinedUnitsRegex = new RegExp(`(\\d+)\\s*(${UNITS.join('|')})`, 'g')

/**
 * @type {CommandHandlerFn}
 * @param {string} markdown
 * @returns {string}
 */
export const glueUnits = (markdown) => {
  return markdown.replace(combinedUnitsRegex, '$1&nbsp;$2')
}

/**
 * @type {CommandHandlerFn}
 * @param {string} markdown
 * @returns {string}
 */
export const glueWords = (markdown) => {
  return markdown.replace(/\b(1:6|2:6|3:6|4:6|5:6)\b/g, '<nobr>$1</nobr>')
}

const UNITS_JOIN = ['′', '″']
const combinedUnitsJoinRegex = new RegExp(`(\\d+)(${UNITS_JOIN.join('|')})`, 'g')

/**
 * @type {CommandHandlerFn}
 * @param {string} markdown
 * @returns {string}
 */
export const glueUnitsWithNoLineBreaks = (markdown) => {
  return markdown.replace(combinedUnitsJoinRegex, '<nobr>$1$2</nobr>')
}

/**
 * Wrap certain hyphenated terms in <nobr>...</nobr>, capturing declensions up to word boundary.
 */

const HYPH = '(?:-|-|–|—)' // hyphen, non-breaking hyphen (U+2011), en dash, em dash
const CRYSTAL_PREFIXES = ['Телепорт', 'Хроно', 't', 'g', 'f']

// "Хвост слова": любые буквы/цифры/подчёркивания после основы.
// Это и будет «склонение» (кристалл+Ы/ОВ/АМ..., пол+Ю/Е/Я...)
const WORD_TAIL = '[\\p{L}\\p{N}_]*'

// Чтобы корректно работать с кириллицей, используем Unicode-границы слова
const LEFT_BOUNDARY = '(?<![\\p{L}\\p{N}_])'
const RIGHT_BOUNDARY = '(?![\\p{L}\\p{N}_])'

// 1) Телепорт-кристаллы / t-кристаллов / g-кристаллами / ...
// 2) t-полю / t-полем / t-поля / ...
const combinedNobrTermsRegex = new RegExp(
  [
    `${LEFT_BOUNDARY}((?:${CRYSTAL_PREFIXES.join('|')})${HYPH}кристалл${WORD_TAIL})${RIGHT_BOUNDARY}`,
    `${LEFT_BOUNDARY}(t${HYPH}пол${WORD_TAIL})${RIGHT_BOUNDARY}`,
  ].join('|'),
  'gu', // g=global, u=unicode (важно для \p{...})
)

/**
 * @type {CommandHandlerFn}
 * @param {string} markdown
 * @returns {string}
 */
export const glueCrystalsAlike = (markdown) => {
  return markdown.replace(combinedNobrTermsRegex, (m) => `<nobr>${m}</nobr>`)
}

/**
 * @type {CommandHandlerFn}
 * @param {string} markdown
 * @returns {string}
 */
export const glueDamageUnits = (markdown) => {
  const DAMAGE_OR_TURN_RE =
    /(^|[^A-Za-zА-Яа-яЁё0-9_])((?:\d*d\d!?)(?:\s*\(\d+\))?|\d+)\s+((?:урон|ход|раунд|раз)\p{L}*)/giu

  return markdown.replace(DAMAGE_OR_TURN_RE, '$1$2&nbsp;$3')
}

const SHORTHANDS = [
  'и т. д.',
  'и т.д.',
  'и т. п.',
  'и т.п.',
  'в т. ч.',
  'в т.ч.',
  'и др.',
  'и пр.',
  'т. д.',
  'т.д.',
  'т. п.',
  'т.п.',
  'т. е.',
  'т.е.',
  'т. к.',
  'т.к.',
  'т. н.',
  'т.н.',
]

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const shorthandToPattern = (value) => value.trim().split(/\s+/).map(escapeRegex).join('\\s+')

const SHORTHANDS_RE = new RegExp(
  `(^|[^\\p{L}\\p{N}_])(${SHORTHANDS.slice()
    .sort((a, b) => b.length - a.length)
    .map(shorthandToPattern)
    .join('|')})(?=$|[^\\p{L}\\p{N}_])`,
  'giu',
)

export const glueShorthands = (markdown) => {
  return markdown.replace(SHORTHANDS_RE, '$1<nobr>$2</nobr>')
}
