/**
 * @file Expands inline stat-block shorthand into styled HTML.
 *
 * Stat blocks are written as single-backtick fenced objects using a compact
 * `key: value` syntax separated by semicolons. The macro parses the block,
 * translates the English stat abbreviations used as keys into the target
 * language, resolves special values (alignment codes, multiattack links),
 * and emits semantic HTML.
 *
 * The pattern `` `{ … }` `` is used (single braces) to distinguish stat
 * blocks from the conditional syntax `` `{{ … }}` `` (double braces).
 *
 * The output language is controlled by `config.statsLang` (`'en'` by
 * default, `'ru'` also supported).
 *
 * @module macros/stats-insert
 *
 * @example Minimal stat block
 * ```markdown
 * `{ AC: 14; HD: 2; HP: 9; MV: 40; A: N; XP: 20 }`
 * ```
 *
 * @example Full stat block with multiattack
 * ```markdown
 * `{ AC: 16; HD: 4; HP: 18; Atk: 2; DMG: 1d6/1d6; MV: 30; ML: 9; A: C; XP: 125; S: F4; CL: 4 }`
 * ```
 *
 * @example Rendered HTML (simplified, `statsLang: 'ru'`)
 * ```html
 * <div class="stats-insert no-page-break">
 *   <span class="stat-record"><span class="stat-name">КБ</span>:&nbsp;<span class="stat-value">14</span></span>
 *   <span class="stat-record"><span class="stat-name">ХД</span>:&nbsp;<span class="stat-value">2</span></span>
 *   …
 * </div>
 * ```
 */

import type { IDocumentConfig, StatsLang } from '../types'

const DEFAULT_STATS_LANG: StatsLang = 'en'

/**
 * Per-language display labels for stat abbreviations, keyed by the English
 * abbreviation used as the stat-block key.
 *
 * | Key   | EN    | RU                    | Meaning                |
 * |-------|-------|-----------------------|------------------------|
 * | `Atk` | Atk   | Атаки                 | Attacks (multiattack)  |
 * | `LVL` | LVL   | Уровень               | Level                  |
 * | `AC`  | AC    | КБ                    | Armour Class           |
 * | `HD`  | HD    | ХД                    | Hit Dice               |
 * | `HP`  | HP    | ХП                    | Hit Points             |
 * | `DMG` | DMG   | Урон                  | Damage                 |
 * | `MV`  | MV    | Скорость              | Movement Speed         |
 * | `ML`  | ML    | Мораль                | Morale                 |
 * | `A`   | A     | МВ                    | Alignment (Мировоззр.) |
 * | `XP`  | XP    | Опыт                  | Experience Points      |
 * | `CL`  | CL    | Сложность             | Challenge Level        |
 * | `S`   | S     | Спасброски            | Saving Throws          |
 * | `MR`  | MR    | Устойчивость к магии  | Magic Resistance       |
 */
const statsTranslations: Record<StatsLang, Map<string, string>> = {
  en: new Map([
    ['Atk', 'Attacks'],
    ['LVL', 'LVL'],
    ['AC', 'AC'],
    ['HD', 'HD'],
    ['HP', 'HP'],
    ['DMG', 'Damage'],
    ['MV', 'MV'],
    ['ML', 'ML'],
    ['A', 'A'],
    ['XP', 'XP'],
    ['CL', 'CL'],
    ['S', 'S'],
    ['MR', 'MR'],
  ]),
  ru: new Map([
    ['Atk', 'Атаки'],
    ['LVL', 'Уровень'],
    ['AC', 'КБ'],
    ['HD', 'ХД'],
    ['HP', 'ХП'],
    ['DMG', 'Урон'],
    ['MV', 'Скорость'],
    ['ML', 'Мораль'],
    ['A', 'МВ'],
    ['XP', 'Опыт'],
    ['CL', 'Сложность'],
    ['S', 'Спасброски'],
    ['MR', 'Устойчивость к магии'],
  ]),
}

/** Per-language labels for alignment codes (the `A` stat). */
const alignmentLabels: Record<StatsLang, Record<'C' | 'L' | 'N', string>> = {
  en: { C: 'Chaotic', L: 'Lawful', N: 'Neutral' },
  ru: { C: 'Хаос', L: 'Законное', N: 'Нейтральное' },
}

/** Per-language label for a dash (`-`) value, meaning "none". */
const noneLabels: Record<StatsLang, string> = {
  en: 'None',
  ru: 'Нет',
}

/** Per-language multiattack anchor title and badge-variant suffix. */
const attackLabels: Record<StatsLang, { title: string; badgeSuffix: string }> = {
  en: { title: 'Multiattack, see the note at the beginning of the module', badgeSuffix: 'attacks' },
  ru: { title: 'Мультиатака, смотри примечание в начале модуля', badgeSuffix: 'атаки' },
}

/**
 * Resolve special stat values to their display form in the given language.
 *
 * - Alignment (`A`): `C` / `L` / `N` → the language's alignment label.
 * - Dash (`-`): rendered as the language's "none" label.
 * - All other values are returned as-is.
 *
 * @param statName - The stat key (e.g. `"A"`, `"HD"`).
 * @param value    - The raw value string from the stat block.
 * @param lang     - The target language.
 * @returns The resolved display value.
 * @throws If `statName` is `"A"` and the value is not `C`, `L`, or `N`.
 */
const resolveValueFor = (statName: string, value: string, lang: StatsLang): string => {
  if (statName === 'A') {
    const label = alignmentLabels[lang][value as 'C' | 'L' | 'N']
    if (!label) {
      throw new Error(`Unknown alignment: ${value}`)
    }

    return label
  }
  if (value === '-') {
    return noneLabels[lang]
  }

  return value
}

/**
 * Render the `Atk` (multiattack) stat as an anchor linking to the
 * multiattack rules explanation.
 *
 * @param value  - The attack description (e.g. `"2"`, `"1d6/1d6"`).
 * @param lang   - The target language.
 * @param option - Render variant: `1` (default, inline) or `2` (badge style).
 * @returns HTML string for the attack stat.
 */
const handleAttack = (value: string, lang: StatsLang, option = 1): string => {
  const attackName = statsTranslations[lang].get('Atk')
  const { title, badgeSuffix } = attackLabels[lang]

  return option === 1
    ? [
        `<span class="stat-record">`,
        `<a title="${title}" href="#anchor-multiattack">`,
        `<span class="stat-name">${attackName}</span>:&nbsp;`,
        `<span class="stat-value">${value}</span>`,
        `</a>`,
        `</span>\n`,
      ].join('')
    : `<span class="stat-record stat-record--attack">
        <a title="${title}" href="#anchor-multiattack">[${value} ${badgeSuffix}]</a>
      </span>\n`
}

/**
 * Parse a raw stat-block string and render each stat as an HTML
 * `<span class="stat-record">` element.
 *
 * @param markdown - The content between `{ }` braces (semicolon-separated
 *                   `key: value` pairs).
 * @param lang     - The target language.
 * @returns Concatenated HTML for all stat records, or the original string
 *          if nothing was rendered.
 * @throws If a stat key is not found in {@link statsTranslations} or a value
 *         is empty.
 */
const renderStatsBlock = (markdown: string, lang: StatsLang): string => {
  const chunks = markdown.replace(/^{|}$/g, '').split(';')
  let htmlFormatted = ''

  chunks.forEach((chunk) => {
    const [key, value] = chunk
      .split(/:(.+)/)
      .filter(Boolean)
      .map((i) => i.trim())

    const statName = statsTranslations[lang].get(key)
    if (!statName) {
      throw new Error(`Unknown stat name: "${key}"`)
    }
    if (!value) {
      throw new Error(`Falsy stat value: "${value}"`)
    }

    if (key === 'Atk') {
      htmlFormatted += handleAttack(value, lang)
    } else {
      htmlFormatted += [
        `<span class="stat-record">`,
        `<span class="stat-name">${statName}</span>:&nbsp;`,
        `<span class="stat-value">${resolveValueFor(key, value, lang)}</span>`,
        `</span>\n`,
      ].join('')
    }
  })

  return htmlFormatted || markdown
}

/**
 * Replace every `` `{ … }` `` stat-block shorthand with a rendered HTML
 * `<div class="stats-insert">` block.
 *
 * The pattern uses single braces `` `{ … }` `` (a negative lookahead
 * excludes the double-brace conditional syntax `` `{{ … }}` ``).
 *
 * @param markdown - Source Markdown string.
 * @param config   - Build config; `config.statsLang` selects the output
 *                   language (defaults to `'en'`).
 * @returns Markdown with stat blocks replaced by styled HTML.
 */
export const convertStatsInserts = (markdown: string, config?: IDocumentConfig): string => {
  const lang = config?.statsLang ?? DEFAULT_STATS_LANG
  const commandPattern = /`{(?!{)([\s\S]+?)}`/g

  if (!commandPattern.exec(markdown)) {
    return markdown
  }
  commandPattern.lastIndex = 0

  return markdown.replace(commandPattern, (match, content: string) => {
    return !content
      ? match
      : [`<div class="stats-insert no-page-break">`, renderStatsBlock(content.trim(), lang), `</div>`].join('\n')
  })
}
