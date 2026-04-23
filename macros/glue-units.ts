/**
 * @file Typography macros that prevent unwanted line breaks around numbers,
 * units, abbreviations, and compound terms.
 *
 * Six independent functions are exported; each targets a specific class of
 * typographic pattern. They are registered as separate pipeline steps so
 * they can be reordered or disabled individually.
 *
 * @module macros/glue-units
 *
 * @example glueUnits — number + measurement unit
 * ```markdown
 * Коридор длиной 10 м    →  Коридор длиной 10&nbsp;м
 * Весит 5 фунтов         →  Весит 5&nbsp;фунтов
 * ```
 *
 * @example glueWords — dice odds
 * ```markdown
 * Шанс 2:6   →  Шанс <nobr>2:6</nobr>
 * ```
 *
 * @example glueUnitsWithNoLineBreaks — number + prime/double-prime
 * ```markdown
 * 10′ высотой   →  <nobr>10′</nobr> высотой
 * 5″            →  <nobr>5″</nobr>
 * ```
 *
 * @example glueCrystalsAlike — compound terms with hyphens
 * ```markdown
 * Телепорт-кристалл   →  <nobr>Телепорт-кристалл</nobr>
 * t-кристаллы         →  <nobr>t-кристаллы</nobr>
 * t-поле              →  <nobr>t-поле</nobr>
 * ```
 *
 * @example glueDamageUnits — damage/duration values
 * ```markdown
 * 2d6 урона      →  2d6&nbsp;урона
 * 3 раунда       →  3&nbsp;раунда
 * 1 ход          →  1&nbsp;ход
 * ```
 *
 * @example glueShorthands — Russian abbreviations
 * ```markdown
 * и т. д.   →  <nobr>и т. д.</nobr>
 * т. е.     →  <nobr>т. е.</nobr>
 * ```
 */

/** Supported measurement unit suffixes. */
const UNITS = ['мм', 'см', 'зм', 'фунтов']
const combinedUnitsRegex = new RegExp(`(\\d+)\\s*(${UNITS.join('|')})`, 'g')

/**
 * Insert `&nbsp;` between a number and a measurement unit (мм, см, зм, фунтов).
 *
 * @param markdown - Source Markdown string.
 * @returns Markdown with non-breaking spaces inserted.
 */
export const glueUnits = (markdown: string): string => {
  return markdown.replace(combinedUnitsRegex, '$1&nbsp;$2')
}

/**
 * Wrap dice-odds notation (`1:6`..`5:6`) in `<nobr>` to prevent line breaks.
 *
 * @param markdown - Source Markdown string.
 * @returns Markdown with dice odds wrapped.
 */
export const glueWords = (markdown: string): string => {
  return markdown.replace(/\b(1:6|2:6|3:6|4:6|5:6)\b/g, '<nobr>$1</nobr>')
}

/** Prime / double-prime symbols (feet / inches). */
const UNITS_JOIN = ['′', '″']
const combinedUnitsJoinRegex = new RegExp(`(\\d+)(${UNITS_JOIN.join('|')})`, 'g')

/**
 * Wrap `<number><prime>` pairs (e.g. `10′`, `5″`) in `<nobr>`.
 *
 * @param markdown - Source Markdown string.
 * @returns Markdown with prime/double-prime units wrapped.
 */
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

/**
 * FIXME
 * Wrap compound crystal/field terms (e.g. `Телепорт-кристалл`, `t-поле`)
 * in `<nobr>` to prevent mid-word line breaks.
 *
 * Matches any of the prefixes (`Телепорт`, `Хроно`, `t`, `g`, `f`) joined
 * by a hyphen/dash to `кристалл*` or `t-пол*`.
 *
 * @param markdown - Source Markdown string.
 * @returns Markdown with compound terms wrapped.
 */
export const glueCrystalsAlike = (markdown: string): string => {
  return markdown.replace(combinedNobrTermsRegex, (m) => `<nobr>${m}</nobr>`)
}

/**
 * Insert `&nbsp;` between a damage/dice expression and its unit word
 * (урон*, ход*, раунд*, раз*).
 *
 * Handles both dice notation (`2d6 урона`) and plain numbers (`3 раунда`).
 *
 * @param markdown - Source Markdown string.
 * @returns Markdown with non-breaking spaces inserted before damage/duration units.
 */
export const glueDamageUnits = (markdown: string): string => {
  const DAMAGE_OR_TURN_RE =
    /(^|[^A-Za-zА-Яа-яЁё0-9_])((?:\d*d\d!?)(?:\s*\(\d+\))?|\d+)\s+((?:урон|ход|раунд|раз)\p{L}*)/giu

  return markdown.replace(DAMAGE_OR_TURN_RE, '$1$2&nbsp;$3')
}

/** Common Russian abbreviations to wrap (sorted longest-first for greedy matching). */
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

/**
 * Wrap common Russian abbreviations (и т. д., т. е., и др., etc.) in `<nobr>`
 * so they are never split across lines.
 *
 * @param markdown - Source Markdown string.
 * @returns Markdown with abbreviations wrapped.
 */
export const glueShorthands = (markdown: string): string => {
  return markdown.replace(SHORTHANDS_RE, '$1<nobr>$2</nobr>')
}
