import type { IDocumentConfig } from '../../types'
import { convertStatsInserts } from '../stats-insert'

const ruConfig = { statsLang: 'ru' } as IDocumentConfig

describe('convert stats inserts', () => {
  it('should convert cmd into html using English labels by default', () => {
    expect(
      convertStatsInserts(
        `\`{ AC: 14; HD: ½ (2hp); DMG: d4-1 (dagger) or d6-1 (sword); MV: 60' (20'); ML: 6; A: C }\``,
      ).trim(),
    ).toMatchSnapshot()
  })

  it('should convert cmd into html using Russian labels when statsLang is "ru"', () => {
    expect(
      convertStatsInserts(
        `\`{ AC: 14; HD: ½ (2hp); DMG: d4-1 (кинжал) или d6-1 (меч); MV: 60' (20'); ML: 6; A: C }\``,
        ruConfig,
      ).trim(),
    ).toMatchSnapshot()
  })

  it('should ignore conditional blocks `{{ ... }}` completely', () => {
    const input = `My text: \`{{ main: Main content | osr: OSR content }}\`, for real`
    expect(convertStatsInserts(input)).toEqual(input)
  })

  it('should convert stats blocks but leave conditional blocks untouched in the same string', () => {
    const input = `A \`{ AC: 14; ML: 6; A: C }\` ` + `B \`{{ main: Main content | osr: OSR content }}\` ` + `C`

    const out = convertStatsInserts(input).trim()

    expect(out).toContain(`<div class="stats-insert no-page-break">`)
    expect(out).toContain(`<span class="stat-name">AC</span>`)
    expect(out).toContain(`<span class="stat-value">14</span>`)
    expect(out).toContain('`{{ main: Main content | osr: OSR content }}`')
    expect(out.startsWith('A ')).toBe(true)
    expect(out.endsWith(' C')).toBe(true)
  })

  it('should leave markdown unchanged if there are no backticked stats blocks', () => {
    const input = `No macros here. { AC: 14 } is not backticked.`
    expect(convertStatsInserts(input)).toEqual(input)
  })

  it('should convert multiple stats inserts in one line', () => {
    const input = `X \`{ AC: 14; ML: 6; A: C }\` Y \`{ AC: 15; ML: 7; A: N }\` Z`
    const out = convertStatsInserts(input)

    const count = (out.match(/<div class="stats-insert no-page-break">/g) || []).length
    expect(count).toBe(2)

    expect(out).toContain(`<span class="stat-value">14</span>`)
    expect(out).toContain(`<span class="stat-value">15</span>`)
  })

  it('should handle multiline stats blocks', () => {
    const input = `Start
\`{ AC: 14;
HD: ½ (2hp);
ML: 6;
A: C }\`
End`

    const out = convertStatsInserts(input).trim()

    expect(out).toContain(`<div class="stats-insert no-page-break">`)
    expect(out).toContain(`<span class="stat-name">AC</span>`)
    expect(out).toContain(`<span class="stat-value">14</span>`)
    expect(out).toContain(`<span class="stat-name">HD</span>`)
    expect(out).toContain(`<span class="stat-value">½ (2hp)</span>`)
    expect(out).toContain(`<span class="stat-name">ML</span>`)
    expect(out).toContain(`<span class="stat-value">6</span>`)
    expect(out).toContain(`<span class="stat-name">A</span>`)
    expect(out).toContain(`<span class="stat-value">Chaotic</span>`)
  })

  it('should handle multiline stats blocks in Russian', () => {
    const input = `Start
\`{ AC: 14;
HD: ½ (2hp);
ML: 6;
A: C }\`
End`

    const out = convertStatsInserts(input, ruConfig).trim()

    expect(out).toContain(`<span class="stat-name">КБ</span>`)
    expect(out).toContain(`<span class="stat-name">ХД</span>`)
    expect(out).toContain(`<span class="stat-name">Мораль</span>`)
    expect(out).toContain(`<span class="stat-name">МВ</span>`)
    expect(out).toContain(`<span class="stat-value">Хаос</span>`)
  })

  it('should not treat `{{` as stats macro start even if it resembles stats-like content', () => {
    const input = `\`{{ AC: 14; ML: 6; A: C }}\``
    expect(convertStatsInserts(input)).toEqual(input)
  })

  it('should throw on unknown stat name in a stats block', () => {
    expect(() => convertStatsInserts(`\`{ WTF: 123; AC: 14 }\``)).toThrow(/Unknown stat name/)
  })

  it('should throw on unknown alignment', () => {
    expect(() => convertStatsInserts(`\`{ AC: 14; A: X }\``)).toThrow(/Unknown alignment/)
  })

  it('should convert "-" into "None" by default', () => {
    const out = convertStatsInserts(`\`{ MR: -; AC: 14 }\``).trim()
    expect(out).toContain(`<span class="stat-name">MR</span>`)
    expect(out).toContain(`<span class="stat-value">None</span>`)
  })

  it('should convert "-" into "Нет" when statsLang is "ru"', () => {
    const out = convertStatsInserts(`\`{ MR: -; AC: 14 }\``, ruConfig).trim()
    expect(out).toContain(`<span class="stat-name">Устойчивость к магии</span>`)
    expect(out).toContain(`<span class="stat-value">Нет</span>`)
  })

  it('should render the Atk stat with English labels by default', () => {
    const out = convertStatsInserts(`\`{ Atk: 2; AC: 14 }\``).trim()
    expect(out).toContain(`<span class="stat-name">Atk</span>`)
    expect(out).toContain('title="Multiattack, see the note at the beginning of the module"')
  })

  it('should render the Atk stat with Russian labels when statsLang is "ru"', () => {
    const out = convertStatsInserts(`\`{ Atk: 2; AC: 14 }\``, ruConfig).trim()
    expect(out).toContain(`<span class="stat-name">Атаки</span>`)
    expect(out).toContain('title="Мультиатака, смотри примечание в начале модуля"')
  })
})
