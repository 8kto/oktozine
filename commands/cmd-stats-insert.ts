/**
 * @file Expand shortened stats block `{ AC: 14; HD: ½; ... }` into HTML layout.
 */

import type { CommandHandlerFn } from '../types'

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
