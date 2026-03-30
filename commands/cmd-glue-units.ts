/**
 * @file Add non-breakable spaces between numbers and units, wrap shorthands in <nobr>.
 */

import type { CommandHandlerFn } from '../types'

const UNITS = ['мм', 'см', 'зм', 'фунтов']
const combinedUnitsRegex = new RegExp(`(\\d+)\\s*(${UNITS.join('|')})`, 'g')

export const glueUnits = (markdown: string): string => {
  return markdown.replace(combinedUnitsRegex, '$1&nbsp;$2')
}

export const glueWords = (markdown: string): string => {
  return markdown.replace(/\b(1:6|2:6|3:6|4:6|5:6)\b/g, '<nobr>$1</nobr>')
}

const UNITS_JOIN = ['′', '″']
const combinedUnitsJoinRegex = new RegExp(`(\\d+)(${UNITS_JOIN.join('|')})`, 'g')

export const glueUnitsWithNoLineBreaks = (markdown: string): string => {
  return markdown.replace(combinedUnitsJoinRegex, '<nobr>$1$2</nobr>')
}

const HYPH = '(?:-|-|–|—)'
const CRYSTAL_PREFIXES = ['Телепорт', 'Хроно', 't', 'g', 'f']
const WORD_TAIL = '[\\p{L}\\p{N}_]*'
const LEFT_BOUNDARY = '(?<![\\p{L}\\p{N}_])'
const RIGHT_BOUNDARY = '(?![\\p{L}\\p{N}_])'

const combinedNobrTermsRegex = new RegExp(
  [
    `${LEFT_BOUNDARY}((?:${CRYSTAL_PREFIXES.join('|')})${HYPH}кристалл${WORD_TAIL})${RIGHT_BOUNDARY}`,
    `${LEFT_BOUNDARY}(t${HYPH}пол${WORD_TAIL})${RIGHT_BOUNDARY}`,
  ].join('|'),
  'gu',
)

export const glueCrystalsAlike = (markdown: string): string => {
  return markdown.replace(combinedNobrTermsRegex, (m) => `<nobr>${m}</nobr>`)
}

export const glueDamageUnits = (markdown: string): string => {
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

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const shorthandToPattern = (value: string): string => value.trim().split(/\s+/).map(escapeRegex).join('\\s+')

const SHORTHANDS_RE = new RegExp(
  `(^|[^\\p{L}\\p{N}_])(${SHORTHANDS.slice()
    .sort((a, b) => b.length - a.length)
    .map(shorthandToPattern)
    .join('|')})(?=$|[^\\p{L}\\p{N}_])`,
  'giu',
)

export const glueShorthands = (markdown: string): string => {
  return markdown.replace(SHORTHANDS_RE, '$1<nobr>$2</nobr>')
}
