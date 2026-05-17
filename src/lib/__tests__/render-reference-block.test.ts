import { handleLists, renderReferenceBlock } from '../render-reference-block'

describe('handleLists', () => {
  it('converts bold list items into damage-prop em elements', () => {
    expect(handleLists('- **Урон**')).toBe('- <em class="damage-prop">Урон</em>')
  })

  it('handles multiple items', () => {
    const input = '- **Урон**: 1к6\n- **Атака**: +3\n- plain item'
    const result = handleLists(input)
    expect(result).toContain('<em class="damage-prop">Урон</em>')
    expect(result).toContain('<em class="damage-prop">Атака</em>')
    expect(result).toContain('- plain item')
  })

  it('does not modify non-bold list items', () => {
    expect(handleLists('- plain text')).toBe('- plain text')
  })

  it('returns empty string unchanged', () => {
    expect(handleLists('')).toBe('')
  })
})

describe('renderReferenceBlock', () => {
  it('renders a basic ref block with title and content', () => {
    const result = renderReferenceBlock({ title: 'Goblin', content: 'A small creature.' })
    expect(result).toContain('class="ref-insert"')
    expect(result).toContain('Goblin')
    expect(result).toContain('A small creature.')
    expect(result).toContain('<header')
    expect(result).toContain('<section')
    expect(result).toContain('<main>')
  })

  it('uses custom headerTagName when provided', () => {
    const result = renderReferenceBlock({ title: 'Title', content: 'Body', headerTagName: 'h2' })
    expect(result).toContain('<h2 ')
    expect(result).toContain('</h2>')
    expect(result).not.toContain('<header')
  })

  it('applies alternate look class', () => {
    const result = renderReferenceBlock({ title: 'T', content: 'C', hasAlternateLook: true })
    expect(result).toContain('alternative')
  })

  it('applies alternate header class', () => {
    const result = renderReferenceBlock({ title: 'T', content: 'C', hasAlternateHeader: true })
    expect(result).toContain('ref-header--alt')
  })

  it('applies no-page-break class when shouldWrap is true', () => {
    const result = renderReferenceBlock({ title: 'T', content: 'C', shouldWrap: true })
    expect(result).toContain('no-page-break')
  })

  it('omits the header when hasNoHeader is true', () => {
    const result = renderReferenceBlock({ title: 'T', content: 'C', hasNoHeader: true })
    expect(result).not.toContain('T')
    expect(result).not.toContain('<header')
  })

  it('includes idAttr in section tag', () => {
    const result = renderReferenceBlock({ title: 'T', content: 'C', idAttr: ' id="my-ref"' })
    expect(result).toContain('<section id="my-ref"')
  })
})
