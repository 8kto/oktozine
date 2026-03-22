import { assembleDocumentHtml, buildChunkRanges, compareHtmlFiles, resolveChunkPlan } from '../build-pdf'
import type { IPartProperties } from '../types'

// ── buildChunkRanges ─────────────────────────────────────────────────────────

describe('buildChunkRanges', () => {
  it('builds correct ranges for N=3, chunkSize=50', () => {
    expect(buildChunkRanges(3, 50)).toEqual(['1-50', '51-100', '101-999999'])
  })

  it('last chunk is always open-ended', () => {
    const ranges = buildChunkRanges(2, 100)
    expect(ranges[ranges.length - 1]).toBe('101-999999')
  })

  it('returns a single open-ended range for N=1', () => {
    expect(buildChunkRanges(1, 100)).toEqual(['1-999999'])
  })

  it('produces N ranges', () => {
    expect(buildChunkRanges(5, 20)).toHaveLength(5)
  })

  it('ranges are contiguous and non-overlapping', () => {
    const ranges = buildChunkRanges(4, 10)
    expect(ranges).toEqual(['1-10', '11-20', '21-30', '31-999999'])
  })
})

// ── resolveChunkPlan ─────────────────────────────────────────────────────────

describe('resolveChunkPlan', () => {
  const base: IPartProperties = { id: 'test' }

  it('uses config values directly when both are provided', () => {
    const config = { ...base, buildProcessesNum: 3, buildPartSize: 60 }
    expect(resolveChunkPlan(config, 200)).toEqual({ N: 3, chunkSize: 60 })
  })

  it('falls back to PDF_PARALLEL and computed chunkSize when neither is provided', () => {
    // PDF_PARALLEL defaults to 4 when PDF_PARALLEL env var is unset
    const { N, chunkSize } = resolveChunkPlan(base, 100)
    expect(N).toBe(4)
    expect(chunkSize).toBe(25) // ceil(100 / 4)
  })

  it('caps N at approxPageCount for small documents', () => {
    const { N, chunkSize } = resolveChunkPlan(base, 2)
    expect(N).toBe(2) // min(PDF_PARALLEL=4, 2) = 2
    expect(chunkSize).toBe(1) // ceil(2 / 2) = 1
  })

  it('uses config N and computes chunkSize when only buildProcessesNum is provided', () => {
    const config = { ...base, buildProcessesNum: 2 }
    const { N, chunkSize } = resolveChunkPlan(config, 100)
    expect(N).toBe(2)
    expect(chunkSize).toBe(50) // ceil(100 / 2)
  })

  it('computes N and uses config chunkSize when only buildPartSize is provided', () => {
    const config = { ...base, buildPartSize: 30 }
    const { N, chunkSize } = resolveChunkPlan(config, 100)
    expect(N).toBe(4) // min(PDF_PARALLEL=4, 100) = 4
    expect(chunkSize).toBe(30) // from config
  })

  it('rounds up when page count is not evenly divisible', () => {
    const { chunkSize } = resolveChunkPlan(base, 7)
    // min(4, 7)=4 workers; ceil(7/4)=2
    expect(chunkSize).toBe(2)
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

  it('treats numeric prefixes (chapter numbers) as plain characters', () => {
    // Alphabetical: "01-" < "02-"
    expect(compareHtmlFiles('01-intro.md.html', '02-battle.md.html')).toBeLessThan(0)
  })

  it('does not confuse a numeric chapter prefix with an incremented variant', () => {
    // "01-intro.md.html" is NOT an incremented variant — its base is itself
    expect(compareHtmlFiles('01-intro.md.html', '01-intro-2.md.html')).toBeLessThan(0)
  })

  it('sorts can be used to produce a stable order via Array.sort', () => {
    const files = ['intro-2.md.html', '03-battle.md.html', 'intro.md.html', '01-prologue.md.html']
    const sorted = [...files].sort(compareHtmlFiles)
    expect(sorted).toEqual(['01-prologue.md.html', '03-battle.md.html', 'intro.md.html', 'intro-2.md.html'])
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
    const delimCount = (html.match(/page-delimiter/g) ?? []).length
    expect(delimCount).toBe(2) // 3 pages → 2 delimiters (not after last)
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
    expect(html).toContain('<back/>')
    expect(html).not.toContain('page-delimiter')
  })

  it('returns an empty string when there is no content', () => {
    expect(assembleDocumentHtml({ id: 'mod' }, null, [], null)).toBe('')
  })

  it('puts cover before pages and back-cover after', () => {
    const html = assembleDocumentHtml(config, '<cover/>', [['p.md.html', '<body/>']], '<back/>')
    const coverIdx = html.indexOf('<cover/>')
    const bodyIdx = html.indexOf('<body/>')
    const backIdx = html.indexOf('<back/>')
    expect(coverIdx).toBeLessThan(bodyIdx)
    expect(bodyIdx).toBeLessThan(backIdx)
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
