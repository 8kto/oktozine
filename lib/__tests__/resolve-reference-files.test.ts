import { parseMarkdown } from '../resolve-reference-files'

describe('parseMarkdown', () => {
  it('parses a single ## section into a ref entry', () => {
    const md = `## Goblin\nA small green creature.`
    const result = parseMarkdown(md)
    expect(result['Goblin']).toBeDefined()
    expect(result['Goblin'].fullText).toBe('A small green creature.')
    expect(result['Goblin'].shortText).toBe('A small green creature.')
  })

  it('uses first sentence as shortText when there are no stats', () => {
    const md = `## Dragon\nA fire-breathing beast. Very dangerous.`
    const result = parseMarkdown(md)
    expect(result['Dragon'].shortText).toBe('A fire-breathing beast.')
    expect(result['Dragon'].fullText).toBe('A fire-breathing beast. Very dangerous.')
  })

  it('uses last line as shortText when it starts with backtick stats block', () => {
    const md = '## Goblin\nA creature.\n`{ AC: 13, HP: 4 }`'
    const result = parseMarkdown(md)
    expect(result['Goblin'].shortText).toBe('`{ AC: 13, HP: 4 }`')
  })

  it('parses multiple sections', () => {
    const md = `## Goblin\nSmall creature.\n## Troll\nLarge creature.`
    const result = parseMarkdown(md)
    expect(Object.keys(result)).toHaveLength(2)
    expect(result['Goblin']).toBeDefined()
    expect(result['Troll']).toBeDefined()
  })

  it('stops collecting lines when encountering # (h1)', () => {
    const md = `## Goblin\nSmall creature.\n# Chapter\nMore text\n## Troll\nLarge creature.`
    const result = parseMarkdown(md)
    // Goblin section should end at the h1
    expect(result['Goblin'].fullText.trim()).toBe('Small creature.')
    expect(result['Troll']).toBeDefined()
  })

  it('throws on empty ## title', () => {
    expect(() => parseMarkdown('## \nContent')).toThrow('Empty title')
  })

  it('returns empty object for empty input', () => {
    expect(parseMarkdown('')).toEqual({})
  })

  it('ignores lines before the first ## heading', () => {
    const md = `# Intro\nSome text\n## Entry\nBody`
    const result = parseMarkdown(md)
    expect(Object.keys(result)).toHaveLength(1)
    expect(result['Entry']).toBeDefined()
  })
})
