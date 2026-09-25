/** @jest-environment node */

import { PDFDocument } from 'pdf-lib'

import { buildChunkRanges, isBlankPage, resolveChunkPlan, trimPageSizeTransitionArtifacts } from '../build-pdf'
import { IDocumentConfig } from '../types'

// ── trimPageSizeTransitionArtifacts ──────────────────────────────────────────

describe('trimPageSizeTransitionArtifacts', () => {
  const LANDSCAPE: [number, number] = [420, 298]
  const PORTRAIT: [number, number] = [298, 420]

  const addBlankPage = (doc: PDFDocument, size: [number, number]): void => {
    doc.addPage(size)
  }

  const addContentPage = (doc: PDFDocument, size: [number, number]): void => {
    const page = doc.addPage(size)
    page.drawText('Real page content, definitely over twenty bytes long.', { x: 10, y: 10, size: 12 })
  }

  /**
   * isBlankPage() (used internally by trimPageSizeTransitionArtifacts) only
   * recognizes a page's content stream once it's a real PDFRawStream, which
   * pdf-lib only produces after a save/reload round-trip — matching how the
   * real pipeline always operates on pages loaded from already-saved chunk
   * PDFs. A freshly-drawn, never-saved page reads as blank regardless of its
   * content, so tests must round-trip too or they'd misrepresent both the
   * "blank" and "non-blank" cases.
   */
  const roundTrip = async (doc: PDFDocument): Promise<PDFDocument> => PDFDocument.load(await doc.save())

  it('removes a single blank page sandwiched between a size change', async () => {
    const doc = await PDFDocument.create()
    addContentPage(doc, LANDSCAPE) // p1: real landscape content
    addBlankPage(doc, LANDSCAPE) // p2: blank artifact, same size as p1
    addContentPage(doc, PORTRAIT) // p3: real portrait content (e.g. back cover)

    const reloaded = await roundTrip(doc)
    const trimmed = trimPageSizeTransitionArtifacts(reloaded)

    expect(trimmed).toBe(1)
    expect(reloaded.getPageCount()).toBe(2)
  })

  it('removes a run of multiple consecutive blank artifacts', async () => {
    const doc = await PDFDocument.create()
    addContentPage(doc, LANDSCAPE)
    addBlankPage(doc, LANDSCAPE)
    addBlankPage(doc, LANDSCAPE)
    addContentPage(doc, PORTRAIT)

    const reloaded = await roundTrip(doc)
    const trimmed = trimPageSizeTransitionArtifacts(reloaded)

    expect(trimmed).toBe(2)
    expect(reloaded.getPageCount()).toBe(2)
  })

  it('leaves a blank page alone when it matches the size of the page it precedes', async () => {
    const doc = await PDFDocument.create()
    addContentPage(doc, LANDSCAPE)
    addBlankPage(doc, LANDSCAPE) // same size as what follows — not a transition artifact
    addContentPage(doc, LANDSCAPE)

    const reloaded = await roundTrip(doc)
    const trimmed = trimPageSizeTransitionArtifacts(reloaded)

    expect(trimmed).toBe(0)
    expect(reloaded.getPageCount()).toBe(3)
  })

  it('does not touch a document with no size transition', async () => {
    const doc = await PDFDocument.create()
    addContentPage(doc, LANDSCAPE)
    addContentPage(doc, LANDSCAPE)
    addContentPage(doc, LANDSCAPE)

    const reloaded = await roundTrip(doc)
    const trimmed = trimPageSizeTransitionArtifacts(reloaded)

    expect(trimmed).toBe(0)
    expect(reloaded.getPageCount()).toBe(3)
  })

  it('stops at the first non-blank page walking backward', async () => {
    const doc = await PDFDocument.create()
    addContentPage(doc, LANDSCAPE) // p1
    addContentPage(doc, LANDSCAPE) // p2: real content, not blank
    addContentPage(doc, PORTRAIT) // p3: size change, but p2 isn't blank

    const reloaded = await roundTrip(doc)
    const trimmed = trimPageSizeTransitionArtifacts(reloaded)

    expect(trimmed).toBe(0)
    expect(reloaded.getPageCount()).toBe(3)
  })

  it('still works after a prior removePage() call has already staled the page cache', async () => {
    // Reproduces the real mergeChunks() call sequence: the trailing-blank
    // trim loop calls getPage()/removePage() before this function runs,
    // which — due to pdf-lib never invalidating its page cache on removal —
    // left getPages() returning a stale, pre-removal-length array the first
    // time this regression was caught.
    const doc = await PDFDocument.create()
    addContentPage(doc, LANDSCAPE) // p1
    addBlankPage(doc, LANDSCAPE) // p2: blank artifact, same size as p1
    addBlankPage(doc, LANDSCAPE) // p3: blank artifact
    addContentPage(doc, PORTRAIT) // p4: real portrait content
    addBlankPage(doc, PORTRAIT) // p5: genuine trailing blank

    const reloaded = await roundTrip(doc)

    // Simulate the trailing-blank trim loop that runs immediately before
    // trimPageSizeTransitionArtifacts in mergeChunks().
    while (reloaded.getPageCount() > 0 && isBlankPage(reloaded, reloaded.getPage(reloaded.getPageCount() - 1))) {
      reloaded.removePage(reloaded.getPageCount() - 1)
    }
    expect(reloaded.getPageCount()).toBe(4) // p5 trimmed, p1-p4 remain

    const trimmed = trimPageSizeTransitionArtifacts(reloaded)

    expect(trimmed).toBe(2)
    expect(reloaded.getPageCount()).toBe(2)
  })
})

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

// ── tocOverrides from config ─────────────────────────────────────────────────

describe('tocOverrides merging', () => {
  it('reads tocOverrides from config and merges per-document overrides', () => {
    const conf = {
      id: 'main',
      tocConfig: { headersSelector: 'h2' },
      tocOverrides: { dropLabels: ['Intro'], documents: { main: { dropLabels: ['Intro', 'Cover'] } } },
    } as object as IDocumentConfig
    const { documents = {}, ...tocDefaults } = conf.tocOverrides ?? {}
    const merged = { ...tocDefaults, ...documents[conf.id] }
    expect(merged.dropLabels).toEqual(['Intro', 'Cover'])
  })

  it('falls back to top-level defaults when no per-document override exists', () => {
    const conf = {
      id: 'other',
      tocOverrides: { dropLabels: ['Default'] },
    } as object as IDocumentConfig
    const { documents = {}, ...tocDefaults } = conf.tocOverrides ?? {}
    const merged = { ...tocDefaults, ...documents[conf.id] }
    expect(merged.dropLabels).toEqual(['Default'])
  })
})

// ── resolveChunkPlan ─────────────────────────────────────────────────────────

describe('resolveChunkPlan', () => {
  const base = { id: 'test' } as unknown as IDocumentConfig

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
