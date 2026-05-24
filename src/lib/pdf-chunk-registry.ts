import { createHash } from 'node:crypto'

import fs from 'fs-extra'
import path from 'path'

import { logger } from './logger'

// ── Types ────────────────────────────────────────────────────────────────────

export interface IChunkRegistry {
  documentId: string
  builtAt: number
  N: number
  chunkSize: number
  /** All tracked file base-names → MD5 hash of their content. CSS is stored under '__css__'. */
  fileHashes: Record<string, string>
}

export interface IIncrementalBuildInfo {
  /** Ordered list of HTML file base-names (cover → body pages → back-cover). */
  fileOrder: string[]
  /** base-name → MD5 content hash for every HTML file + '__css__'. */
  fileHashes: Record<string, string>
}

export interface IIncrementalPlan {
  /** chunk index → pre-loaded Buffer (safe to reuse). */
  cached: Map<number, Buffer>
  /** Chunk indices that must be freshly rendered. */
  toRebuild: Set<number>
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** MD5 hex digest of a string — fast enough for build-time comparison. */
export const hashContent = (s: string): string => createHash('md5').update(s).digest('hex')

/**
 * Assigns each HTML file (by position in the ordered file list) to a chunk
 * index (0-based). The mapping is approximate — it is based on file count, not
 * real page counts — but errs on the side of over-rendering (false positives)
 * rather than under-rendering (false negatives).
 */
export const assignFilesToChunks = (names: string[], N: number): Map<string, number> => {
  const M = Math.max(1, names.length)

  return new Map(names.map((name, i) => [name, Math.min(N - 1, Math.floor((i * N) / M))]))
}

// ── Path helpers ─────────────────────────────────────────────────────────────

export const registryPath = (basePath: string, documentId: string): string =>
  path.join(basePath, `${documentId}-registry.json`)

export const chunkCachePath = (basePath: string, documentId: string, i: number): string =>
  path.join(basePath, `${documentId}-chunk-${i}.pdf`)

// ── Registry I/O ─────────────────────────────────────────────────────────────

export const loadRegistry = async (basePath: string, documentId: string): Promise<IChunkRegistry | null> => {
  try {
    return JSON.parse(await fs.readFile(registryPath(basePath, documentId), 'utf8')) as IChunkRegistry
  } catch {
    return null
  }
}

export const saveRegistry = (basePath: string, registry: IChunkRegistry): Promise<void> =>
  fs.writeFile(registryPath(basePath, registry.documentId), JSON.stringify(registry, null, 2))

// ── Incremental plan ─────────────────────────────────────────────────────────

/**
 * Compares current file hashes against the last registry snapshot to decide
 * which PDF chunks must be re-rendered and which can be loaded from disk.
 */
export const resolveIncrementalPlan = async (
  basePath: string,
  documentId: string,
  fileOrder: string[],
  allFileHashes: Record<string, string>,
  N: number,
  chunkSize: number,
): Promise<IIncrementalPlan> => {
  const rebuildAll = (): IIncrementalPlan => ({
    cached: new Map(),
    toRebuild: new Set(Array.from({ length: N }, (_, i) => i)),
  })

  const registry = await loadRegistry(basePath, documentId)
  if (!registry || registry.N !== N || registry.chunkSize !== chunkSize) {
    return rebuildAll()
  }

  // Any CSS change affects every page → rebuild all chunks.
  if (registry.fileHashes['__css__'] !== allFileHashes['__css__']) {
    logger.debug(`CSS changed for "${documentId}" — rebuilding all chunks`)

    return rebuildAll()
  }

  // If the set of HTML files changed (added/removed), page order may have
  // shifted and we can no longer trust the chunk→file assignment.
  const prevHtmlNames = Object.keys(registry.fileHashes).filter((k) => k !== '__css__')
  if (prevHtmlNames.length !== fileOrder.length || fileOrder.some((n) => registry.fileHashes[n] === undefined)) {
    logger.debug(`HTML file set changed for "${documentId}" — rebuilding all chunks`)

    return rebuildAll()
  }

  // Find chunks that contain at least one changed file.
  const fileToChunk = assignFilesToChunks(fileOrder, N)
  const toRebuild = new Set<number>()
  for (const name of fileOrder) {
    if (registry.fileHashes[name] !== allFileHashes[name]) {
      const ci = fileToChunk.get(name) ?? 0
      toRebuild.add(ci)
      logger.debug(`"${name}" changed → chunk ${ci} queued for rebuild`)
    }
  }

  // Load cached PDF buffers for every unchanged chunk.
  const cached = new Map<number, Buffer>()
  await Promise.all(
    Array.from({ length: N }, (_, i) => i)
      .filter((i) => !toRebuild.has(i))
      .map(async (i) => {
        try {
          cached.set(i, await fs.readFile(chunkCachePath(basePath, documentId, i)))
        } catch {
          toRebuild.add(i) // cache file missing or unreadable
        }
      }),
  )

  if (toRebuild.size < N) {
    logger.info(`Incremental PDF: rendering ${toRebuild.size}/${N} chunks, reusing ${N - toRebuild.size} from cache`)
  }

  return { cached, toRebuild }
}
