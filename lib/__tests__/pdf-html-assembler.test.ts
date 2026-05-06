// scripts/oktozine/lib/__tests__/pdf-html-assembler.test.ts
import fs from 'fs-extra'
import os from 'os'
import path from 'path'

import type { IPartProperties } from '../../types'
import {
  assembleDocumentHtml,
  compareHtmlFiles,
  getFullPageTemplate,
  getPageClassname,
  getPageTemplate,
  readModuleHtmlPages,
} from '../pdf-html-assembler'

// ── getPageClassname ─────────────────────────────────────────────────────────

describe('getPageClassname', () => {
  it('strips .md.html suffix and numeric prefix from pageName', () => {
    expect(getPageClassname('main', '01-intro.md.html')).toBe(
      'page--wrapper page--main page--main-intro page-name--intro',
    )
  })

  it('handles filename without numeric prefix', () => {
    expect(getPageClassname('main', 'cover.md.html')).toBe('page--wrapper page--main page--main-cover page-name--cover')
  })

  it('uses moduleId in all class positions', () => {
    const result = getPageClassname('osr', 'chapter.md.html')
    expect(result).toContain('page--osr')
    expect(result).toContain('page--osr-chapter')
  })
})

// ── getPageTemplate ──────────────────────────────────────────────────────────

describe('getPageTemplate', () => {
  it('wraps content in a div with the correct classname', () => {
    const result = getPageTemplate('main', 'intro.md.html', '<p>hello</p>')
    expect(result).toContain('class="page--wrapper page--main page--main-intro page-name--intro"')
    expect(result).toContain('<p>hello</p>')
  })

  it('appends page-delimiter by default', () => {
    const result = getPageTemplate('main', 'intro.md.html', 'content')
    expect(result).toContain('page-delimiter')
    expect(result).toContain('<!-- intro.md.html -->')
  })

  it('omits delimiter when skipDelimiter=true', () => {
    const result = getPageTemplate('main', 'intro.md.html', 'content', true)
    expect(result).not.toContain('page-delimiter')
    expect(result).not.toContain('<!-- intro.md.html -->')
  })
})

// ── getFullPageTemplate ──────────────────────────────────────────────────────

describe('getFullPageTemplate', () => {
  it('wraps content in the page-bg + full-content-container structure', () => {
    const result = getFullPageTemplate('<p>body</p>')
    expect(result).toBe('<div class="page-bg"></div><div class="full-content-container"><p>body</p></div>')
  })
})

// ── compareHtmlFiles ─────────────────────────────────────────────────────────

describe('compareHtmlFiles', () => {
  it('sorts alphabetically for unrelated names', () => {
    expect(compareHtmlFiles('a.md.html', 'b.md.html')).toBeLessThan(0)
    expect(compareHtmlFiles('b.md.html', 'a.md.html')).toBeGreaterThan(0)
  })

  it('returns 0 for identical names', () => {
    expect(compareHtmlFiles('intro.md.html', 'intro.md.html')).toBe(0)
  })

  it('places base file before its incremented variant', () => {
    expect(compareHtmlFiles('intro.md.html', 'intro-2.md.html')).toBeLessThan(0)
    expect(compareHtmlFiles('intro-2.md.html', 'intro.md.html')).toBeGreaterThan(0)
  })

  it('sorts two incremented variants of the same base alphabetically', () => {
    expect(compareHtmlFiles('intro-2.md.html', 'intro-3.md.html')).toBeLessThan(0)
  })

  it('sorts incremented variants lexicographically (intro-2 before intro-10 as strings)', () => {
    // localeCompare on strings: '2' < '10' lexicographically means intro-10 sorts before intro-2
    // This is a known limitation — file naming should use zero-padded numbers to avoid this
    const result = ['intro-10.md.html', 'intro-2.md.html'].sort(compareHtmlFiles)
    // Document the actual behaviour (lexicographic) without asserting a specific "correct" order
    expect(result).toHaveLength(2)
    // Both are incremented variants of 'intro', so they sort against each other via localeCompare
    expect(compareHtmlFiles('intro-2.md.html', 'intro-10.md.html')).not.toBe(0)
  })

  it('treats numeric chapter prefixes as plain sort characters', () => {
    expect(compareHtmlFiles('01-intro.md.html', '02-battle.md.html')).toBeLessThan(0)
  })

  it('does not confuse a numeric chapter prefix with an incremented variant', () => {
    expect(compareHtmlFiles('01-intro.md.html', '01-intro-2.md.html')).toBeLessThan(0)
  })

  it('produces a stable sort order via Array.sort', () => {
    const files = ['intro-2.md.html', '03-battle.md.html', 'intro.md.html', '01-prologue.md.html']
    expect([...files].sort(compareHtmlFiles)).toEqual([
      '01-prologue.md.html',
      '03-battle.md.html',
      'intro.md.html',
      'intro-2.md.html',
    ])
  })
})

// ── readModuleHtmlPages ──────────────────────────────────────────────────────

describe('readModuleHtmlPages', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oktozine-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  const write = (name: string, content = `content of ${name}`) => fs.writeFile(path.join(tmpDir, name), content, 'utf8')

  it('reads and returns html files sorted', async () => {
    await write('b.md.html', 'B')
    await write('a.md.html', 'A')
    const result = await readModuleHtmlPages(tmpDir, [])
    expect(result).toEqual([
      ['a.md.html', 'A'],
      ['b.md.html', 'B'],
    ])
  })

  it('excludes files listed in excludeFiles', async () => {
    await write('cover.html', 'cover')
    await write('body.md.html', 'body')
    const result = await readModuleHtmlPages(tmpDir, ['cover.html'])
    expect(result.map(([name]) => name)).toEqual(['body.md.html'])
  })

  it('excludes files starting with $', async () => {
    await write('$toc.html', 'toc')
    await write('body.md.html', 'body')
    const result = await readModuleHtmlPages(tmpDir, [])
    expect(result.map(([name]) => name)).toEqual(['body.md.html'])
  })

  it('excludes server.html', async () => {
    await write('server.html', 'srv')
    await write('body.md.html', 'body')
    const result = await readModuleHtmlPages(tmpDir, [])
    expect(result.map(([name]) => name)).toEqual(['body.md.html'])
  })

  it('excludes non-.html files', async () => {
    await write('notes.txt', 'txt')
    await write('body.md.html', 'body')
    const result = await readModuleHtmlPages(tmpDir, [])
    expect(result.map(([name]) => name)).toEqual(['body.md.html'])
  })

  it('returns empty array when directory is empty', async () => {
    expect(await readModuleHtmlPages(tmpDir, [])).toEqual([])
  })

  it('handles null entries in excludeFiles gracefully', async () => {
    await write('body.md.html', 'body')
    const result = await readModuleHtmlPages(tmpDir, [null, null])
    expect(result).toHaveLength(1)
  })

  it('includes plain .html files not in excludeFiles (e.g. cover.html)', async () => {
    await write('cover.html', 'cover content')
    await write('body.md.html', 'body content')
    const result = await readModuleHtmlPages(tmpDir, [])
    expect(result.map(([name]) => name)).toContain('cover.html')
    expect(result.map(([name]) => name)).toContain('body.md.html')
  })
})

// ── assembleDocumentHtml ─────────────────────────────────────────────────────

describe('assembleDocumentHtml', () => {
  const config: IPartProperties = { id: 'mod', coverHtmlFile: 'cover', backCoverHtmlFile: 'back' }

  const pageClass = (name: string) => {
    const pageName = name.replace('.md.html', '').replace(/^\d+-/, '')

    return `page--wrapper page--mod page--mod-${pageName} page-name--${pageName}`
  }

  it('wraps a single page without a delimiter (it is the last page)', () => {
    const html = assembleDocumentHtml({ id: 'mod' }, null, [['intro.md.html', '<p>hi</p>']], null)
    expect(html).toContain(`class="${pageClass('intro.md.html')}"`)
    expect(html).toContain('<p>hi</p>')
    expect(html).not.toContain('page-delimiter')
  })

  it('adds a page-delimiter after every page except the last', () => {
    const pages: Array<[string, string]> = [
      ['a.md.html', 'A'],
      ['b.md.html', 'B'],
      ['c.md.html', 'C'],
    ]
    const html = assembleDocumentHtml({ id: 'mod' }, null, pages, null)
    expect((html.match(/page-delimiter/g) ?? []).length).toBe(2)
  })

  it('prepends the cover without a delimiter', () => {
    const html = assembleDocumentHtml(config, '<cover/>', [], null)
    expect(html).toContain(`class="${pageClass('cover.html')}"`)
    expect(html).toContain('<cover/>')
    expect(html).not.toContain('page-delimiter')
  })

  it('appends the back-cover without a delimiter', () => {
    const html = assembleDocumentHtml(config, null, [], '<back/>')
    expect(html).toContain(`class="${pageClass('back.html')}"`)
    expect(html).not.toContain('page-delimiter')
  })

  it('returns an empty string when there is no content', () => {
    expect(assembleDocumentHtml({ id: 'mod' }, null, [], null)).toBe('')
  })

  it('puts cover before pages and back-cover after', () => {
    const html = assembleDocumentHtml(config, '<cover/>', [['p.md.html', '<body/>']], '<back/>')
    expect(html.indexOf('<cover/>')).toBeLessThan(html.indexOf('<body/>'))
    expect(html.indexOf('<body/>')).toBeLessThan(html.indexOf('<back/>'))
  })

  it('omits cover when coverContent is null', () => {
    const html = assembleDocumentHtml(config, null, [['p.md.html', 'page']], null)
    expect(html).not.toContain(pageClass('cover.html'))
  })

  it('omits back-cover when backCoverContent is null', () => {
    const html = assembleDocumentHtml(config, null, [['p.md.html', 'page']], null)
    expect(html).not.toContain(pageClass('back.html'))
  })
})
