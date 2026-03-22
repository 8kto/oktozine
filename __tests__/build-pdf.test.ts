import { buildChunkRanges } from '../build-pdf'

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
