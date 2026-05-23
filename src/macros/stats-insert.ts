/** TODO split up EN/RU versions
 * @file Expands inline stat-block shorthand into styled HTML.
 *
 * Stat blocks are written as single-backtick fenced objects using a compact
 * `key: value` syntax separated by semicolons. The macro parses the block,
 * translates English stat abbreviations to Russian, resolves special values
 * (alignment codes, multiattack links), and emits semantic HTML.
 *
 * The pattern `` `{ … }` `` is used (single braces) to distinguish stat
 * blocks from the conditional syntax `` `{{ … }}` `` (double braces).
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
 * @example Rendered HTML (simplified)
 * ```html
 * <div class="stats-insert no-page-break">
 *   <span class="stat-record"><span class="stat-name">КБ</span>:&nbsp;<span class="stat-value">14</span></span>
 *   <span class="stat-record"><span class="stat-name">ХД</span>:&nbsp;<span class="stat-value">2</span></span>
 *   …
 * </div>
 * ```
 */

/**
 * Map of English stat abbreviations to their Russian translations.
 *
 * | Key   | Russian          | Meaning                |
 * |-------|------------------|------------------------|
 * | `Atk` | Атаки            | Attacks (multiattack)  |
 * | `LVL` | Уровень          | Level                  |
 * | `AC`  | КБ               | Armour Class           |
 * | `HD`  | ХД               | Hit Dice               |
 * | `HP`  | ХП               | Hit Points             |
 * | `DMG` | Урон             | Damage                 |
 * | `MV`  | Скорость         | Movement Speed         |
 * | `ML`  | Мораль           | Morale                 |
 * | `A`   | МВ               | Alignment (Мировоззр.) |
 * | `XP`  | Опыт             | Experience Points      |
 * | `CL`  | Сложность        | Challenge Level        |
 * | `S`   | Спасброски       | Saving Throws          |
 * | `MR`  | Устойчивость к магии | Magic Resistance   |
 */
const statsTranslations = new Map([
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
])

/**
 * Resolve special stat values to their Russian equivalents.
 *
 * - Alignment (`A`): `C` → Хаос, `L` → Законное, `N` → Нейтральное.
 * - Dash (`-`): rendered as "Нет" (none).
 * - All other values are returned as-is.
 *
 * @param statName - The stat key (e.g. `"A"`, `"HD"`).
 * @param value    - The raw value string from the stat block.
 * @returns The resolved display value.
 * @throws If `statName` is `"A"` and the value is not `C`, `L`, or `N`.
 */
const resolveValueFor = (statName: string, value: string): string => {
  if (statName === 'A') {
    switch (value) {
      case 'C':
        return 'Хаос'
      case 'L':
        return 'Законное'
      case 'N':
        return 'Нейтральное'
      default:
        throw new Error(`Unknown alignment: ${value}`)
    }
  }
  if (value === '-') {
    return 'Нет'
  }

  return value
}

/**
 * Render the `Atk` (multiattack) stat as an anchor linking to the
 * multiattack rules explanation.
 *
 * @param value  - The attack description (e.g. `"2"`, `"1d6/1d6"`).
 * @param option - Render variant: `1` (default, inline) or `2` (badge style).
 * @returns HTML string for the attack stat.
 */
const handleAttack = (value: string, option = 1): string => {
  return option === 1
    ? [
        `<span class="stat-record">`,
        `<a title="Мультиатака, смотри примечание в начале модуля" href="#anchor-multiattack">`,
        `<span class="stat-name">Атаки</span>:&nbsp;`,
        `<span class="stat-value">${value}</span>`,
        `</a>`,
        `</span>\n`,
      ].join('')
    : `<span class="stat-record stat-record--attack">
        <a title="Мультиатака, смотри примечание в начале модуля" href="#anchor-multiattack">[${value} атаки]</a>
      </span>\n`
}

/**
 * Parse a raw stat-block string and render each stat as an HTML
 * `<span class="stat-record">` element.
 *
 * @param markdown - The content between `{ }` braces (semicolon-separated
 *                   `key: value` pairs).
 * @returns Concatenated HTML for all stat records, or the original string
 *          if nothing was rendered.
 * @throws If a stat key is not found in {@link statsTranslations} or a value
 *         is empty.
 */
const renderStatsBlock = (markdown: string): string => {
  const chunks = markdown.replace(/^{|}$/g, '').split(';')
  let htmlFormatted = ''

  chunks.forEach((chunk) => {
    const [key, value] = chunk
      .split(/:(.+)/)
      .filter(Boolean)
      .map((i) => i.trim())

    const statName = statsTranslations.get(key)
    if (!statName) {
      throw new Error(`Unknown stat name: "${key}"`)
    }
    if (!value) {
      throw new Error(`Falsy stat value: "${value}"`)
    }

    if (key === 'Atk') {
      htmlFormatted += handleAttack(value)
    } else {
      htmlFormatted += [
        `<span class="stat-record">`,
        `<span class="stat-name">${statName}</span>:&nbsp;`,
        `<span class="stat-value">${resolveValueFor(key, value)}</span>`,
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
 * @returns Markdown with stat blocks replaced by styled HTML.
 */
export const convertStatsInserts = (markdown: string): string => {
  const commandPattern = /`{(?!{)([\s\S]+?)}`/g

  if (!commandPattern.exec(markdown)) {
    return markdown
  }
  commandPattern.lastIndex = 0

  return markdown.replace(commandPattern, (match, content: string) => {
    return !content
      ? match
      : [`<div class="stats-insert no-page-break">`, renderStatsBlock(content.trim()), `</div>`].join('\n')
  })
}
