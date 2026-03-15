import { parseConditionalMode } from '../cmd-parse-conditional-mode.mjs'

describe('parses conditionals', () => {
  it('should parse mode [main]', () => {
    expect(
      parseConditionalMode(`My text: \`{{ main: Main content | osr: OSR content }}\``, { id: 'main' }).trim(),
    ).toEqual(`My text: <span class="conditional conditional-block--main">Main content</span>`)
  })

  it('should parse mode [osr]', () => {
    expect(
      parseConditionalMode(`My text: \`{{ main: Main content | osr: OSR content }}\`, for real`, { id: 'osr' }).trim(),
    ).toEqual(`My text: <span class="conditional conditional-block--osr">OSR content</span>, for real`)
  })

  it('should ignore missed mode', () => {
    expect(
      parseConditionalMode(`My text: \`{{ main: Main content | osr: OSR content }}\`, for real`, { id: '5e' }).trim(),
    ).toEqual(`My text: , for real`)
  })

  it('should tolerate whitespace around separators and colon', () => {
    expect(
      parseConditionalMode(`My text: \`{{   main :   Main content    |   osr  :   OSR content   }}\``, {
        id: 'osr',
      }).trim(),
    ).toEqual(`My text: <span class="conditional conditional-block--osr">OSR content</span>`)
  })

  it('should work when target branch is the first one', () => {
    expect(
      parseConditionalMode(`My text: \`{{ osr: OSR content | main: Main content }}\``, { id: 'osr' }).trim(),
    ).toEqual(`My text: <span class="conditional conditional-block--osr">OSR content</span>`)
  })

  it('should handle multiple macros in one line', () => {
    expect(
      parseConditionalMode(`A \`{{ main: X | osr: Y }}\` B \`{{ main: M | osr: N }}\` C`, { id: 'main' }).trim(),
    ).toEqual(
      `A <span class="conditional conditional-block--main">X</span> B <span class="conditional conditional-block--main">M</span> C`,
    )
  })

  it('should drop only the unmatched macro, keep surrounding punctuation', () => {
    expect(parseConditionalMode(`Start (\`{{ main: X | osr: Y }}\`) end.`, { id: '5e' }).trim()).toEqual(
      `Start () end.`,
    )
  })

  it('should not match a mode as a substring of another mode (main vs main2)', () => {
    expect(parseConditionalMode(`My text: \`{{ main2: Wrong | main: Right }}\``, { id: 'main' }).trim()).toEqual(
      `My text: <span class="conditional conditional-block--main">Right</span>`,
    )
  })

  it('should support underscores and dashes in id', () => {
    expect(parseConditionalMode(`My text: \`{{ osr_new: OK | main: NO }}\``, { id: 'osr_new' }).trim()).toEqual(
      `My text: <span class="conditional conditional-block--osr_new">OK</span>`,
    )
  })

  it('should support digits in id', () => {
    expect(parseConditionalMode(`My text: \`{{ v2: OK | main: NO }}\``, { id: 'v2' }).trim()).toEqual(
      `My text: <span class="conditional conditional-block--v2">OK</span>`,
    )
  })

  it('should work with multiline content inside the macro', () => {
    expect(
      parseConditionalMode(`My text:\n\`{{ main: Line 1\nLine 2 | osr: Single }}\`\nDone`, { id: 'main' }).trim(),
    ).toEqual(`My text:\n<span class="conditional conditional-block--main">Line 1\nLine 2</span>\nDone`)
  })

  it('should leave markdown unchanged if there are no macros', () => {
    const input = `No macros here.`
    expect(parseConditionalMode(input, { id: 'main' })).toEqual(input)
  })

  it('should throw on invalid id (regex meta chars)', () => {
    expect(() => parseConditionalMode(`My text: \`{{ main: X | osr: Y }}\``, { id: 'osr)' })).toThrow(/Invalid id/)
  })

  it('should throw on invalid id (whitespace)', () => {
    expect(() => parseConditionalMode(`My text: \`{{ main: X | osr: Y }}\``, { id: 'osr new' })).toThrow(/Invalid id/)
  })

  // ---------------------------
  // Alias feature tests
  // ---------------------------

  it('should use alias when direct mode is not found (bestiary -> main)', () => {
    expect(
      parseConditionalMode(`My text: \`{{ osr: OSR content | main: Main content }}\``, {
        id: 'bestiary',
        conditionalsAlias: { bestiary: 'main', 'bestiary-osr': 'osr' },
      }).trim(),
    ).toEqual(`My text: <span class="conditional conditional-block--main">Main content</span>`)
  })

  it('should use alias when direct mode is not found (bestiary-osr -> osr)', () => {
    expect(
      parseConditionalMode(`My text: \`{{ osr: OSR content | main: Main content }}\``, {
        id: 'bestiary-osr',
        conditionalsAlias: { bestiary: 'main', 'bestiary-osr': 'osr' },
      }).trim(),
    ).toEqual(`My text: <span class="conditional conditional-block--osr">OSR content</span>`)
  })

  it('should prefer direct match over alias when both could apply', () => {
    // Here the block includes BOTH "bestiary:" and "main:".
    // Since direct match exists, we must render bestiary branch (not alias main).
    expect(
      parseConditionalMode(`My text: \`{{ bestiary: Direct content | main: Alias content | osr: OSR }}\``, {
        id: 'bestiary',
        conditionalsAlias: { bestiary: 'main' },
      }).trim(),
    ).toEqual(`My text: <span class="conditional conditional-block--bestiary">Direct content</span>`)
  })

  it('should remove macro if neither direct nor alias is found', () => {
    expect(
      parseConditionalMode(`My text: \`{{ osr: OSR content | main: Main content }}\`, for real`, {
        id: 'bestiary',
        conditionalsAlias: { bestiary: 'missing' },
      }).trim(),
    ).toEqual(`My text: , for real`)
  })

  it('should remove macro if alias mapping is missing for id', () => {
    expect(
      parseConditionalMode(`My text: \`{{ osr: OSR content | main: Main content }}\`, for real`, {
        id: 'bestiary',
        conditionalsAlias: { 'bestiary-osr': 'osr' },
      }).trim(),
    ).toEqual(`My text: , for real`)
  })

  it('should apply alias logic to multiple macros in the same line', () => {
    expect(
      parseConditionalMode(`A \`{{ main: X | osr: Y }}\` B \`{{ main: M | osr: N }}\` C`, {
        id: 'bestiary-osr',
        conditionalsAlias: { bestiary: 'main', 'bestiary-osr': 'osr' },
      }).trim(),
    ).toEqual(
      `A <span class="conditional conditional-block--osr">Y</span> B <span class="conditional conditional-block--osr">N</span> C`,
    )
  })

  it('should tolerate whitespace in macro and still resolve via alias', () => {
    expect(
      parseConditionalMode(`My text: \`{{   osr  :  OSR content   |  main :  Main content  }}\``, {
        id: 'bestiary',
        conditionalsAlias: { bestiary: 'main' },
      }).trim(),
    ).toEqual(`My text: <span class="conditional conditional-block--main">Main content</span>`)
  })
})
