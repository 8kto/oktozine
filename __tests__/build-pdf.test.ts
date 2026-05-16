/** @jest-environment node */
import { buildChunkRanges, resolveChunkPlan } from '../build-pdf'
import type { IDocumentConfig } from '../types'

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
    } as any
    const { documents = {}, ...tocDefaults } = conf.tocOverrides ?? {}
    const merged = { ...tocDefaults, ...documents[conf.id] }
    expect(merged.dropLabels).toEqual(['Intro', 'Cover'])
  })

  it('falls back to top-level defaults when no per-document override exists', () => {
    const conf = {
      id: 'other',
      tocOverrides: { dropLabels: ['Default'] },
    } as any
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
