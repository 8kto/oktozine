import { convertStatsInserts } from '../cmd-stats-insert.mjs'

describe('convert stats inserts', () => {
  it('should convert cmd into html', () => {
    expect(
      convertStatsInserts(
        `\`{ AC: 14; HD: ½ (2hp); DMG: d4-1 (кинжал) или d6-1 (меч); MV: 60’ (20’); ML: 6; A: C }\``,
      ).trim(),
    ).toEqual(
      `
<div class="no-page-break">
<div class="stats-insert">
<span class="stat-record"><span class="stat-name">AC</span>:&nbsp;<span class="stat-value">14</span></span>
<span class="stat-record"><span class="stat-name">HD</span>:&nbsp;<span class="stat-value">½ (2hp)</span></span>
<span class="stat-record"><span class="stat-name">Урон</span>:&nbsp;<span class="stat-value">d4-1 (кинжал) или d6-1 (меч)</span></span>
<span class="stat-record"><span class="stat-name">Передвижение</span>:&nbsp;<span class="stat-value">60’ (20’)</span></span>
<span class="stat-record"><span class="stat-name">Мораль</span>:&nbsp;<span class="stat-value">6</span></span>
<span class="stat-record"><span class="stat-name">Мировоззрение</span>:&nbsp;<span class="stat-value">Х</span></span>

</div>
</div>
    `.trim(),
    )
  })

  it('should ignore conditional blocks `{{ ... }}` completely', () => {
    const input = `My text: \`{{ main: Main content | osr: OSR content }}\`, for real`
    expect(convertStatsInserts(input)).toEqual(input)
  })

  it('should convert stats blocks but leave conditional blocks untouched in the same string', () => {
    const input = `A \`{ AC: 14; ML: 6; A: C }\` ` + `B \`{{ main: Main content | osr: OSR content }}\` ` + `C`

    const out = convertStatsInserts(input).trim()

    // Stats converted
    expect(out).toContain(`<div class="stats-insert">`)
    expect(out).toContain(`<span class="stat-name">AC</span>`)
    expect(out).toContain(`<span class="stat-value">14</span>`)

    // Conditional untouched
    expect(out).toContain('`{{ main: Main content | osr: OSR content }}`')

    // Surrounding text kept
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

    const count = (out.match(/<div class="stats-insert">/g) || []).length
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

    expect(out).toContain(`<div class="stats-insert">`)
    expect(out).toContain(`<span class="stat-name">AC</span>`)
    expect(out).toContain(`<span class="stat-value">14</span>`)
    expect(out).toContain(`<span class="stat-name">HD</span>`)
    expect(out).toContain(`<span class="stat-value">½ (2hp)</span>`)
    expect(out).toContain(`<span class="stat-name">Мораль</span>`)
    expect(out).toContain(`<span class="stat-value">6</span>`)
    expect(out).toContain(`<span class="stat-name">Мировоззрение</span>`)
    expect(out).toContain(`<span class="stat-value">Х</span>`)
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

  it('should convert "-" into "Нет"', () => {
    const out = convertStatsInserts(`\`{ MR: -; AC: 14 }\``).trim()
    expect(out).toContain(`<span class="stat-name">Устойчивость к магии</span>`)
    expect(out).toContain(`<span class="stat-value">Нет</span>`)
  })
})
