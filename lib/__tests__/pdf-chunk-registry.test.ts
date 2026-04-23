// scripts/oktozine/lib/__tests__/pdf-chunk-registry.test.ts
import fs from 'fs-extra'
import os from 'os'
import path from 'path'

import type { IChunkRegistry } from '../pdf-chunk-registry'
import {
  assignFilesToChunks,
  chunkCachePath,
  hashContent,
  loadRegistry,
  registryPath,
  resolveIncrementalPlan,
  saveRegistry,
} from '../pdf-chunk-registry'

// ── hashContent ──────────────────────────────────────────────────────────────

describe('hashContent', () => {
  it('returns a 32-char hex MD5 string', () => {
    expect(hashContent('hello')).toMatch(/^[0-9a-f]{32}$/)
  })

  it('returns the same hash for the same input', () => {
    expect(hashContent('abc')).toBe(hashContent('abc'))
  })

  it('returns different hashes for different inputs', () => {
    expect(hashContent('a')).not.toBe(hashContent('b'))
  })

  it('handles empty string', () => {
    expect(hashContent('')).toMatch(/^[0-9a-f]{32}$/)
  })
})

// ── assignFilesToChunks ──────────────────────────────────────────────────────

describe('assignFilesToChunks', () => {
  it('returns empty map for empty names', () => {
    expect(assignFilesToChunks([], 4)).toEqual(new Map())
  })

  it('assigns single file to chunk 0', () => {
    expect(assignFilesToChunks(['a.html'], 1)).toEqual(new Map([['a.html', 0]]))
  })

  it('distributes 4 files evenly across 2 chunks', () => {
    const result = assignFilesToChunks(['a', 'b', 'c', 'd'], 2)
    expect(result.get('a')).toBe(0)
    expect(result.get('b')).toBe(0)
    expect(result.get('c')).toBe(1)
    expect(result.get('d')).toBe(1)
  })

  it('distributes 6 files evenly across 3 chunks', () => {
    const result = assignFilesToChunks(['a', 'b', 'c', 'd', 'e', 'f'], 3)
    expect([result.get('a'), result.get('b')]).toEqual([0, 0])
    expect([result.get('c'), result.get('d')]).toEqual([1, 1])
    expect([result.get('e'), result.get('f')]).toEqual([2, 2])
  })

  it('never assigns a chunk index >= N', () => {
    const result = assignFilesToChunks(['a', 'b', 'c'], 2)
    for (const idx of result.values()) {
      expect(idx).toBeLessThan(2)
    }
  })

  it('when N > file count, uses min(N-1, ...) — no index out of bounds', () => {
    const result = assignFilesToChunks(['a', 'b'], 10)
    for (const idx of result.values()) {
      expect(idx).toBeLessThan(10)
    }
  })
})

// ── path helpers ─────────────────────────────────────────────────────────────

describe('registryPath', () => {
  it('builds the correct path', () => {
    expect(registryPath('/build/pdf', 'main')).toBe('/build/pdf/main-registry.json')
  })
})

describe('chunkCachePath', () => {
  it('builds the correct path', () => {
    expect(chunkCachePath('/build/pdf', 'main', 3)).toBe('/build/pdf/main-chunk-3.pdf')
  })
})

// ── loadRegistry / saveRegistry ──────────────────────────────────────────────

describe('loadRegistry / saveRegistry', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oktozine-reg-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  const makeRegistry = (overrides: Partial<IChunkRegistry> = {}): IChunkRegistry => ({
    partId: 'main',
    builtAt: 1000,
    N: 4,
    chunkSize: 10,
    fileHashes: { '__css__': 'abc', 'a.html': 'def' },
    ...overrides,
  })

  it('returns null when registry file does not exist', async () => {
    expect(await loadRegistry(tmpDir, 'missing')).toBeNull()
  })

  it('round-trips a registry through save and load', async () => {
    const reg = makeRegistry()
    await saveRegistry(tmpDir, reg)
    expect(await loadRegistry(tmpDir, 'main')).toEqual(reg)
  })
})

// ── resolveIncrementalPlan ───────────────────────────────────────────────────

describe('resolveIncrementalPlan', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oktozine-plan-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  const files = ['a.html', 'b.html', 'c.html', 'd.html']
  const hashes: Record<string, string> = {
    '__css__': 'css-hash',
    'a.html': 'hash-a',
    'b.html': 'hash-b',
    'c.html': 'hash-c',
    'd.html': 'hash-d',
  }
  const N = 2
  const chunkSize = 10

  const writeRegistry = (reg: Partial<IChunkRegistry> = {}) =>
    saveRegistry(tmpDir, {
      partId: 'main',
      builtAt: Date.now(),
      N,
      chunkSize,
      fileHashes: { ...hashes },
      ...reg,
    })

  const writeChunk = (i: number, data = Buffer.from(`chunk-${i}`)) =>
    fs.writeFile(path.join(tmpDir, `main-chunk-${i}.pdf`), data)

  it('rebuilds all when no registry exists', async () => {
    const plan = await resolveIncrementalPlan(tmpDir, 'main', files, hashes, N, chunkSize)
    expect(plan.toRebuild).toEqual(new Set([0, 1]))
    expect(plan.cached.size).toBe(0)
  })

  it('rebuilds all when N changed', async () => {
    await writeRegistry({ N: 8 })
    const plan = await resolveIncrementalPlan(tmpDir, 'main', files, hashes, N, chunkSize)
    expect(plan.toRebuild).toEqual(new Set([0, 1]))
  })

  it('rebuilds all when chunkSize changed', async () => {
    await writeRegistry({ chunkSize: 99 })
    const plan = await resolveIncrementalPlan(tmpDir, 'main', files, hashes, N, chunkSize)
    expect(plan.toRebuild).toEqual(new Set([0, 1]))
  })

  it('rebuilds all when CSS hash changed', async () => {
    await writeRegistry()
    await writeChunk(0)
    await writeChunk(1)
    const newHashes = { ...hashes, '__css__': 'new-css-hash' }
    const plan = await resolveIncrementalPlan(tmpDir, 'main', files, newHashes, N, chunkSize)
    expect(plan.toRebuild).toEqual(new Set([0, 1]))
    expect(plan.cached.size).toBe(0)
  })

  it('rebuilds all when a file is added', async () => {
    await writeRegistry()
    const newFiles = [...files, 'e.html']
    const newHashes = { ...hashes, 'e.html': 'hash-e' }
    const plan = await resolveIncrementalPlan(tmpDir, 'main', newFiles, newHashes, N, chunkSize)
    expect(plan.toRebuild).toEqual(new Set([0, 1]))
  })

  it('rebuilds all when a file is removed', async () => {
    await writeRegistry()
    const plan = await resolveIncrementalPlan(tmpDir, 'main', ['a.html', 'b.html'], hashes, N, chunkSize)
    expect(plan.toRebuild).toEqual(new Set([0, 1]))
  })

  it('rebuilds only the chunk containing a changed file', async () => {
    await writeRegistry()
    await writeChunk(0)
    await writeChunk(1)
    // 4 files, N=2 → files 0,1 → chunk 0; files 2,3 → chunk 1
    // Change 'c.html' which is at index 2 → chunk 1
    const newHashes = { ...hashes, 'c.html': 'changed-hash' }
    const plan = await resolveIncrementalPlan(tmpDir, 'main', files, newHashes, N, chunkSize)
    expect(plan.toRebuild).toEqual(new Set([1]))
    expect(plan.cached.has(0)).toBe(true)
    expect(plan.cached.get(0)).toEqual(Buffer.from('chunk-0'))
  })

  it('loads nothing and has empty toRebuild when nothing changed and all chunks cached', async () => {
    await writeRegistry()
    await writeChunk(0)
    await writeChunk(1)
    const plan = await resolveIncrementalPlan(tmpDir, 'main', files, hashes, N, chunkSize)
    expect(plan.toRebuild.size).toBe(0)
    expect(plan.cached.size).toBe(2)
  })

  it('adds a chunk to toRebuild when its cache file is missing', async () => {
    await writeRegistry()
    await writeChunk(0)
    // chunk 1 file not written intentionally
    const plan = await resolveIncrementalPlan(tmpDir, 'main', files, hashes, N, chunkSize)
    expect(plan.toRebuild).toEqual(new Set([1]))
    expect(plan.cached.has(0)).toBe(true)
  })
})
