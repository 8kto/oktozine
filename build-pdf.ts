#!/bin/env node

import { mkdir } from 'node:fs/promises'

import fontkit from '@pdf-lib/fontkit'
import chalk from 'chalk'
import fs from 'fs-extra'
import { JSDOM } from 'jsdom'
import path from 'path'
import { PDFArray, PDFDict, PDFDocument, PDFFont, PDFHexString, PDFName, PDFRawStream, PDFRef, rgb } from 'pdf-lib'
import puppeteer from 'puppeteer'

import { tocOverrides } from '../../conf/oktozin.toc.conf'
import packageConfig from '../../package.json' with { type: 'json' }
import { logger } from './lib/logger'
import { measure } from './lib/measure'
import { getCssPath, getHtmlModuleBuildPath, getPdfBuildPath, getReleasePath, PROJECT_ROOT } from './lib/paths'
import {
  chunkCachePath,
  hashContent,
  IIncrementalBuildInfo,
  loadRegistry,
  resolveIncrementalPlan,
  saveRegistry,
} from './lib/pdf-chunk-registry'
import { assembleDocumentHtml, getFullPageTemplate, readModuleHtmlPages } from './lib/pdf-html-assembler'
import { buildToc } from './lib/table-of-contents'
import { getBuildFileVersion } from './lib/version'
import { wrapContentSections } from './lib/wrap-sections'
import type { IDocumentConfig, ITocItem } from './types'

// FIXME hardcoded
const pageNumbersFontPath = path.join(PROJECT_ROOT, 'src/styles/fonts/Philosopher/Philosopher-Regular.ttf')

// Number of parallel Chromium instances for PDF rendering.
// Override with PDF_PARALLEL=N environment variable.
const PDF_PARALLEL = Math.max(1, parseInt(process.env.PDF_PARALLEL ?? '4', 10))

// Each Puppeteer browser instance registers exit/signal handlers on the process.
// With many parallel instances the default limit of 10 triggers a warning.
process.setMaxListeners(0)

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--start-fullscreen',
  '--lang=ru-RU,ru',
  '--disable-translate',
  // Prevents Chrome from using /dev/shm (often limited) for shared memory,
  // which causes PDF rendering failures when many instances run in parallel.
  '--disable-dev-shm-usage',
]

// ── Browser helpers ──────────────────────────────────────────────────────────

const launchBrowser = () => puppeteer.launch({ headless: 'new' as const, defaultViewport: null, args: BROWSER_ARGS })

const setupPage = async (browser: Awaited<ReturnType<typeof launchBrowser>>, html: string, cssPath: string) => {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7' })
  page.on('console', (msg) => logger.info(`PAGE LOG: ${msg.text()}`))
  page.on('requestfailed', (r) => logger.error(`Failed request: ${r.url()} — ${r.failure()?.errorText}`))
  await page.setViewport({ width: 1280, height: 720 })
  await page.setContent(html, { waitUntil: 'networkidle0' })
  await page.addStyleTag({ path: cssPath })
  await page.evaluateHandle('document.fonts.ready')

  return page
}

/**
 * tsx compiles with keepNames:true, injecting __name() calls into serialized
 * function bodies. Define it in the browser context so page.evaluate() works.
 */
const injectNamePolyfill = (page: Awaited<ReturnType<typeof setupPage>>) =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__name = (target: any, value: string) => {
      Object.defineProperty(target, 'name', { value, configurable: true })

      return target
    }
  })

// ── Chunk rendering ──────────────────────────────────────────────────────────

const renderChunkOnce = async (html: string, pageRange: string, cssPath: string): Promise<Buffer> => {
  const browser = await launchBrowser()

  try {
    const page = await setupPage(browser, html, cssPath)
    await page.emulateMediaType('print')

    // No displayHeaderFooter — we add headers/footers via pdf-lib after merge
    // so that page numbers are correct across the full merged document.
    return await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      scale: 1,
      pageRanges: pageRange,
      timeout: 60_000,
    })
  } finally {
    await browser.close()
  }
}

// Retry once on failure — parallel Chrome instances can fail transiently
// due to resource contention (shared memory, CPU spikes, etc.).
const renderChunk = async (html: string, pageRange: string, cssPath: string): Promise<Buffer | null> => {
  try {
    logger.debug(chalk.gray(`Rendering PDF chunk ${pageRange}`))

    return await renderChunkOnce(html, pageRange, cssPath)
  } catch (err) {
    if ((err as Error)?.message.includes('Page range exceeds page count')) {
      return null
    }

    logger.debug(chalk.gray(`chunk ${pageRange}: retrying after error — ${(err as Error).message}`))

    return renderChunkOnce(html, pageRange, cssPath)
  }
}

const writeFullContentToFile = (id: string, content: string, htmlChunksPath: string): void => {
  const htmlPage = `
    <!doctype html>
    <html lang="ru">
    <head>
      <meta charset="utf-8">
      <title>${packageConfig.name}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body>
      <main class="print-root">
        ${content}
      </main>
    </body>
    </html>
  `
  const fileName = `$fullHtmlContent-${id}.html`
  fs.writeFile(path.join(htmlChunksPath, fileName), htmlPage)
  logger.info(chalk.bgBlueBright(`HTML dumped into "${fileName}" file`))
}

// ── PDF DOM preparation ──────────────────────────────────────────────────────

const buildTocForPage = async (
  page: Awaited<ReturnType<typeof setupPage>>,
  config: IDocumentConfig,
  htmlChunksPath: string,
): Promise<void> => {
  const { tocConfig, outputPath } = config

  if (!tocConfig) {
    return
  }

  try {
    const { documents, ...tocDefaults } = tocOverrides
    const mergedTocOverrides = { ...tocDefaults, ...documents?.[config.id] }
    const toc = await page.evaluate(buildToc, { ...config.tocConfig, tocOverrides: mergedTocOverrides })
    const rootId = tocConfig.rootId ?? 'toc-main'
    const tocHtml = await page.evaluate((id: string) => document.getElementById(id)?.innerHTML || '', rootId)

    fs.writeFile(path.join(htmlChunksPath, `$toc-${config.id}.html`), tocHtml)
    fs.writeFile(path.join(outputPath, `$toc-${config.id}.json`), JSON.stringify(toc, null, 2))
  } catch (err) {
    logger.error(err, 'build-pdf: cannot create TOC')
  }
}

/**
 * Estimates the total page count for chunk planning.
 *
 * page-delimiter separates HTML chapters, not PDF pages — one chapter
 * typically spans multiple PDF pages. When buildPartSize/buildProcessesNum
 * are configured the user knows the real page count; the delimiter count is
 * only used as a fallback estimate when those props are absent.
 */
const estimatePageCount = (page: Awaited<ReturnType<typeof setupPage>>, config: IDocumentConfig): Promise<number> => {
  if (config.buildPartSize && config.buildProcessesNum) {
    return Promise.resolve(config.buildPartSize * config.buildProcessesNum)
  }

  return page.evaluate(() => document.querySelectorAll('.page-delimiter').length + 1)
}

interface IPreparedPdf {
  finalHtml: string
  approxPageCount: number
}

/**
 * Phase 1: launch one browser, mutate the DOM (TOC, section-wrap), estimate
 * page count, and serialise the resulting HTML for chunk rendering.
 * Returns null on error (already logged).
 */
const preparePdfHtml = async (
  html: string,
  config: IDocumentConfig,
  htmlChunksPath: string,
): Promise<IPreparedPdf | null> => {
  const browser = await launchBrowser()

  try {
    const page = await setupPage(browser, html, getCssPath(config))
    await injectNamePolyfill(page)
    await buildTocForPage(page, config, htmlChunksPath)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.evaluate(wrapContentSections as any, { selector: '.content', wrapperClass: 'room-section' })

    const approxPageCount = await estimatePageCount(page, config)
    const finalHtml = await page.content()

    if (process.env.BUILD_DUMP_HTML !== 'false') {
      // FIXME use finalHtml?
      const body = await page.evaluate(() => document.body.innerHTML || '')
      writeFullContentToFile(config.id, body, htmlChunksPath)
    }

    return { finalHtml, approxPageCount }
  } catch (err) {
    logger.error(err)

    return null
  } finally {
    await browser.close()
  }
}

interface IChunkPlan {
  N: number
  chunkSize: number
}

/**
 * Resolves chunk count (N) and pages-per-chunk (chunkSize).
 * Uses config values when available; falls back to dividing approxPageCount
 * evenly across up to PDF_PARALLEL workers.
 */
export const resolveChunkPlan = (config: IDocumentConfig, approxPageCount: number): IChunkPlan => {
  const N = config.buildProcessesNum ?? Math.min(PDF_PARALLEL, approxPageCount)
  const chunkSize = config.buildPartSize ?? Math.ceil(approxPageCount / N)

  return { N, chunkSize }
}

// ── PDF /Dests helpers ───────────────────────────────────────────────────────

/**
 * After merging pages from multiple chunk PDFs into mergedPdf, rebuild the
 * /Catalog/Dests flat dictionary so that all hyperlinks point to the correct pages.
 *
 * Chrome stores named destinations in /Catalog/Dests (a flat PDFName→dest dict),
 * not in the /Names/Dests name-tree. Link annotations use /Dest /name-key.
 * Each chunk rendered the same full HTML with different pageRanges, so each
 * chunk's /Dests only contains entries for pages in that chunk's rendered range.
 * We collect one entry per anchor (from whichever chunk covers its target page)
 * and remap the page ref to the merged document.
 */
const rebuildNamedDestinations = (
  mergedPdf: PDFDocument,
  chunks: Array<{ doc: PDFDocument; pageOffset: number }>,
  anchorPageOut?: Map<string, number>,
): void => {
  const mergedPages = mergedPdf.getPages()
  const allEntries: Array<[PDFName, ReturnType<typeof mergedPdf.context.obj>]> = []

  for (const { doc, pageOffset } of chunks) {
    const srcPages = doc.getPages()
    const pageObjNumToLocal = new Map(srcPages.map((p, i) => [p.ref.objectNumber, i]))
    const pageObjNums = new Set(pageObjNumToLocal.keys())

    const catalog = doc.catalog
    // Chrome uses /Catalog/Dests (flat dict with PDFName keys), not /Names/Dests tree
    const destsEntry = catalog.get(PDFName.of('Dests'))
    if (!destsEntry) {
      logger.debug(chalk.yellow(`chunk @${pageOffset}: catalog has no /Dests`))
      continue
    }
    const destsDict = destsEntry instanceof PDFRef ? doc.context.lookup(destsEntry) : destsEntry
    if (!(destsDict instanceof PDFDict)) {
      continue
    }

    let chunkCount = 0
    for (const key of destsDict.keys()) {
      const destVal = destsDict.get(key)
      const dest = destVal instanceof PDFRef ? doc.context.lookup(destVal) : destVal
      if (!(dest instanceof PDFArray)) {
        continue
      }
      const pageRef = dest.get(0)
      if (!(pageRef instanceof PDFRef) || !pageObjNums.has(pageRef.objectNumber)) {
        continue
      }

      const localIdx = pageObjNumToLocal.get(pageRef.objectNumber)
      if (localIdx === undefined) {
        continue
      }
      const mergedPage = mergedPages[pageOffset + localIdx]
      if (!mergedPage) {
        continue
      }

      const newDest = mergedPdf.context.obj([
        mergedPage.ref,
        ...Array.from({ length: dest.size() - 1 }, (_, i) => dest.get(i + 1)),
      ])
      allEntries.push([key, newDest])
      chunkCount++

      if (anchorPageOut) {
        anchorPageOut.set(key.toString().slice(1), pageOffset + localIdx + 1)
      }
    }
    logger.debug(chalk.gray(`chunk @${pageOffset}: ${srcPages.length} pages, ${chunkCount} dests`))
  }

  logger.debug(chalk.gray(`total named destinations collected: ${allEntries.length}`))
  if (allEntries.length === 0) {
    return
  }

  // Rebuild /Catalog/Dests as a flat dict (Chrome's format)
  const newDestsDict = mergedPdf.context.obj({})
  for (const [key, dest] of allEntries) {
    newDestsDict.set(key, dest)
  }
  mergedPdf.catalog.set(PDFName.of('Dests'), newDestsDict)

  logger.debug(chalk.gray(`rebuilt ${allEntries.length} named destinations in /Catalog/Dests`))
}

// ── TOC helpers ──────────────────────────────────────────────────────────────

/** Recursively collects all anchor IDs from TOC items. */
const flattenTocIds = (items: ITocItem[]): string[] =>
  items.flatMap((item) =>
    [item.id, ...(item.items ? flattenTocIds(item.items) : [])].filter((id): id is string => !!id),
  )

// ── PDF outlines (bookmarks) ─────────────────────────────────────────────────

/**
 * Injects a PDF /Outlines tree into `pdf` using the TOC hierarchy and the
 * anchor→page map produced by rebuildNamedDestinations.
 *
 * Items without an `id` or whose id is not in `anchorPageOut` are silently
 * skipped. The outline is fully expanded by default (positive /Count at every
 * level so PDF readers show all items immediately).
 */
const addPdfOutlines = (pdf: PDFDocument, tocItems: ITocItem[], anchorPageOut: Map<string, number>): void => {
  const { context } = pdf
  const pages = pdf.getPages()

  type OutlineNode = { ref: PDFRef; dict: PDFDict; descendantCount: number }

  const buildLevel = (items: ITocItem[], parentRef: PDFRef): OutlineNode[] => {
    const nodes: OutlineNode[] = []

    for (const item of items) {
      if (item.$skipped) {
        continue
      }
      const pageNum = item.id ? anchorPageOut.get(item.id) : undefined
      if (pageNum === undefined) {
        continue
      }
      const page = pages[pageNum - 1]
      if (!page) {
        continue
      }

      const dict = context.obj({}) as PDFDict
      const ref = context.register(dict)

      dict.set(PDFName.of('Title'), PDFHexString.fromText(item.label))
      dict.set(PDFName.of('Dest'), context.obj([page.ref, PDFName.of('XYZ'), null, null, null]))
      dict.set(PDFName.of('Parent'), parentRef)

      let descendantCount = 0
      if (item.items && item.items.length > 0) {
        const children = buildLevel(item.items, ref)
        if (children.length > 0) {
          linkSiblings(children)
          dict.set(PDFName.of('First'), children[0].ref)
          dict.set(PDFName.of('Last'), children[children.length - 1].ref)
          descendantCount = children.reduce((n, c) => n + 1 + c.descendantCount, 0)
          // Positive = subtree open/expanded by default
          dict.set(PDFName.of('Count'), context.obj(descendantCount))
        }
      }

      nodes.push({ ref, dict, descendantCount })
    }

    return nodes
  }

  const linkSiblings = (nodes: OutlineNode[]): void => {
    for (let i = 0; i < nodes.length; i++) {
      if (i > 0) {
        nodes[i].dict.set(PDFName.of('Prev'), nodes[i - 1].ref)
        nodes[i - 1].dict.set(PDFName.of('Next'), nodes[i].ref)
      }
    }
  }

  const rootDict = context.obj({}) as PDFDict
  const rootRef = context.register(rootDict)
  rootDict.set(PDFName.of('Type'), PDFName.of('Outlines'))

  const topNodes = buildLevel(tocItems, rootRef)
  if (topNodes.length === 0) {
    return
  }

  linkSiblings(topNodes)
  rootDict.set(PDFName.of('First'), topNodes[0].ref)
  rootDict.set(PDFName.of('Last'), topNodes[topNodes.length - 1].ref)
  const totalCount = topNodes.reduce((n, c) => n + 1 + c.descendantCount, 0)
  rootDict.set(PDFName.of('Count'), context.obj(totalCount))

  pdf.catalog.set(PDFName.of('Outlines'), rootRef)
  logger.debug(chalk.gray(`Added PDF outline: ${totalCount} bookmark entries`))
}

// ── PDF page decoration ──────────────────────────────────────────────────────

const rgb255 = (r: number, g: number, b: number) => rgb(r / 255, g / 255, b / 255)

interface IDecorateOptions {
  skipHeaderAndFooter?: number[]
  skipHeader?: number[]
  skipFooter?: number[]
}

/**
 * Draws a centered page number footer and a centered title header on each page.
 * All skip arrays use 1-based page numbers; negative values count from the end
 * (-1 = last page, -2 = second-to-last, etc.).
 */
const decoratePdfPages = (
  mergedPdf: PDFDocument,
  headerText: string,
  font: PDFFont,
  opts: IDecorateOptions = {},
): void => {
  const grayColor = rgb255(137, 137, 137)
  const fontSize = 6 // 8px CSS ≈ 6pt in PDF (8 × 72/96)

  const totalPages = mergedPdf.getPageCount()
  const resolve = (pages: number[] = []) => new Set(pages.map((n) => (n < 0 ? totalPages + n + 1 : n)))

  const skipBoth = resolve(opts.skipHeaderAndFooter)
  const skipHdr = resolve(opts.skipHeader)
  const skipFtr = resolve(opts.skipFooter)

  mergedPdf.getPages().forEach((page, i) => {
    const pageNum = i + 1 // 1-based
    const { width, height } = page.getSize()
    const pageNumStr = String(pageNum)

    if (!skipBoth.has(pageNum) && !skipHdr.has(pageNum)) {
      const hdrWidth = font.widthOfTextAtSize(headerText, fontSize)
      page.drawText(headerText, { x: (width - hdrWidth) / 2, y: height - 14, size: fontSize, font, color: grayColor })
    }

    if (!skipBoth.has(pageNum) && !skipFtr.has(pageNum)) {
      const numWidth = font.widthOfTextAtSize(pageNumStr, fontSize)
      page.drawText(pageNumStr, { x: (width - numWidth) / 2, y: 8, size: fontSize, font, color: grayColor })
    }
  })
}

/** Draws header/footer on a specific range of pages (1-based, inclusive). */
const decoratePagesInRange = (
  pdf: PDFDocument,
  headerText: string,
  font: PDFFont,
  fromPage: number,
  toPage: number,
  opts: IDecorateOptions = {},
): void => {
  const grayColor = rgb255(137, 137, 137)
  const fontSize = 6
  const totalPages = pdf.getPageCount()
  const resolve = (pages: number[] = []) => new Set(pages.map((n) => (n < 0 ? totalPages + n + 1 : n)))
  const skipBoth = resolve(opts.skipHeaderAndFooter)
  const skipHdr = resolve(opts.skipHeader)
  const skipFtr = resolve(opts.skipFooter)

  for (let pageNum = fromPage; pageNum <= toPage; pageNum++) {
    const page = pdf.getPage(pageNum - 1)
    const { width, height } = page.getSize()

    if (!skipBoth.has(pageNum) && !skipHdr.has(pageNum)) {
      const hdrWidth = font.widthOfTextAtSize(headerText, fontSize)
      page.drawText(headerText, { x: (width - hdrWidth) / 2, y: height - 14, size: fontSize, font, color: grayColor })
    }
    if (!skipBoth.has(pageNum) && !skipFtr.has(pageNum)) {
      const numStr = String(pageNum)
      const numWidth = font.widthOfTextAtSize(numStr, fontSize)
      page.drawText(numStr, { x: (width - numWidth) / 2, y: 8, size: fontSize, font, color: grayColor })
    }
  }
}

const isBlankPage = (doc: PDFDocument, page: ReturnType<typeof doc.getPage>): boolean => {
  const resolve = (ref: unknown): unknown => (ref instanceof PDFRef ? doc.context.lookup(ref) : ref)

  const contents = page.node.get(PDFName.of('Contents'))
  if (!contents) {
    return true
  }

  const resolved = resolve(contents)

  if (resolved instanceof PDFArray) {
    if (resolved.size() === 0) {
      return true
    }
    for (let i = 0; i < resolved.size(); i++) {
      const stream = resolve(resolved.get(i))
      if (stream instanceof PDFRawStream && stream.contents.length > 20) {
        return false
      }
    }

    return true
  }

  if (resolved instanceof PDFRawStream) {
    return resolved.contents.length <= 20
  }

  return false
}

const mergeChunks = async (
  chunkBuffers: Buffer[],
  headerText: string,
  decorateOpts?: IDecorateOptions,
  anchorPageOut?: Map<string, number>,
): Promise<Uint8Array> => {
  const mergedPdf = await PDFDocument.create()
  mergedPdf.registerFontkit(fontkit)
  const philosopherBytes = await fs.readFile(pageNumbersFontPath)
  const font = await mergedPdf.embedFont(philosopherBytes)

  const chunkMeta: Array<{ doc: PDFDocument; pageOffset: number; pageCount: number }> = []
  let pageOffset = 0

  for (const buf of chunkBuffers) {
    const doc = await PDFDocument.load(buf)
    const srcIndices = doc.getPageIndices()
    if (srcIndices.length === 0) {
      continue
    } // empty chunk (over-estimated page count)

    const copied = await mergedPdf.copyPages(doc, srcIndices)
    copied.forEach((p) => mergedPdf.addPage(p))

    chunkMeta.push({ doc, pageOffset, pageCount: srcIndices.length })
    pageOffset += srcIndices.length
  }

  const endBlankPageDetection = measure('Detect blank page artifacts')
  // Chrome generates a trailing blank page when the last element uses a named CSS page
  // (e.g. `page: fullpage_image` on the back cover). Strip any such blank tail pages
  // before rebuilding named destinations, so page indices remain accurate.
  while (mergedPdf.getPageCount() > 0 && isBlankPage(mergedPdf, mergedPdf.getPage(mergedPdf.getPageCount() - 1))) {
    logger.debug(chalk.gray(`Trimmed trailing blank page; pages remaining: ${mergedPdf.getPageCount() - 1}`))
    mergedPdf.removePage(mergedPdf.getPageCount() - 1)
  }
  logger.info(chalk.gray(endBlankPageDetection()))

  const endRebuildNamedDestinations = measure('Rebuild PDF links')
  rebuildNamedDestinations(mergedPdf, chunkMeta, anchorPageOut)
  logger.info(chalk.gray(endRebuildNamedDestinations()))

  decoratePdfPages(mergedPdf, headerText, font, decorateOpts)

  return mergedPdf.save()
}

// ── Chunk range planning ─────────────────────────────────────────────────────

/**
 * Builds an array of Puppeteer page-range strings (e.g. ["1-50", "51-100", "101-999999"])
 * for splitting the full PDF into N parallel chunks of chunkSize pages each.
 * The last chunk is always open-ended so it captures any over-estimated pages.
 */
export const buildChunkRanges = (N: number, chunkSize: number): string[] =>
  Array.from({ length: N }, (_, i) => {
    const start = i * chunkSize + 1
    const end = i === N - 1 ? 999999 : (i + 1) * chunkSize

    return `${start}-${end}`
  })

// ── Main PDF builder ─────────────────────────────────────────────────────────

const applyOutlines = async (
  bytes: Uint8Array,
  config: IDocumentConfig,
  anchorPageOut: Map<string, number>,
): Promise<Uint8Array> => {
  const tocJsonPath = path.join(config.outputPath, `$toc-${config.id}.json`)
  try {
    const tocItems: ITocItem[] = JSON.parse(await fs.readFile(tocJsonPath, 'utf8'))
    const doc = await PDFDocument.load(bytes)
    addPdfOutlines(doc, tocItems, anchorPageOut)

    return doc.save()
  } catch (err) {
    logger.warn(err, 'Could not add PDF outlines; saving without bookmarks')

    return bytes
  }
}

const createDocumentContentPdf = async (
  html: string,
  outputFilenamePath: string,
  config: IDocumentConfig,
  pdfCachePath: string,
  htmlChunksPath: string,
  incremental?: IIncrementalBuildInfo,
): Promise<void> => {
  // ── Phase 1: DOM setup (TOC, section-wrap, page count, HTML serialisation) ─
  const endSetup = measure('Setup PDF doc: TOC, sections wrap...')
  const prepared = await preparePdfHtml(html, config, htmlChunksPath)
  if (!prepared) {
    return
  }

  const { finalHtml, approxPageCount } = prepared
  const { outputPath } = config
  const { N, chunkSize } = resolveChunkPlan(config, approxPageCount)
  logger.info(chalk.gray(`${endSetup()}, ~${approxPageCount} pages`))

  const incrPlan = incremental
    ? await resolveIncrementalPlan(pdfCachePath, config.id, incremental.fileOrder, incremental.fileHashes, N, chunkSize)
    : { cached: new Map<number, Buffer>(), toRebuild: new Set(Array.from({ length: N }, (_, i) => i)) }

  // ── Phase 2: parallel chunk rendering ─────────────────────────────────────
  const ranges = buildChunkRanges(N, chunkSize)
  const toRenderRanges = ranges.filter((_, i) => incrPlan.toRebuild.has(i))
  logger.info(
    chalk.gray(
      `rendering ${incrPlan.toRebuild.size}/${N} (by ${chunkSize}) chunks: ${toRenderRanges.join(', ') || 'none (all cached)'}`,
    ),
  )
  const endRender = measure('PDF render')

  let chunkResults: Array<{ i: number; buf: Buffer | null }>
  try {
    chunkResults = await Promise.all(
      ranges.map(async (range, i) => {
        if (incrPlan.cached.has(i)) {
          return { i, buf: incrPlan.cached.get(i)! }
        }

        return { i, buf: await renderChunk(finalHtml, range, getCssPath(config)) }
      }),
    )
  } catch (err) {
    logger.error(err)

    return
  }

  logger.info(chalk.gray(endRender()))

  // Persist newly rendered chunks and update the registry for future incremental builds.
  await Promise.all([
    ...chunkResults
      .filter(({ i, buf }) => buf !== null && incrPlan.toRebuild.has(i))
      .map(({ i, buf }) => fs.writeFile(chunkCachePath(pdfCachePath, config.id, i), buf!)),
    incremental
      ? saveRegistry(pdfCachePath, {
          documentId: config.id,
          builtAt: Date.now(),
          N,
          chunkSize,
          fileHashes: incremental.fileHashes,
        })
      : Promise.resolve(),
  ])

  const chunkBuffers = chunkResults.map(({ buf }) => buf).filter((b): b is Buffer => b !== null)

  const decorateOpts: IDecorateOptions = {
    skipHeaderAndFooter: config.skipHeaderAndFooter,
    skipHeader: config.skipHeader,
    skipFooter: config.skipFooter,
  }

  // ── Phase 3: merge + link repair + headers/footers ─────────────────────────
  const endMerge = measure('Merge PDF chunks')
  const anchorPageOut = config.tocConfig ? new Map<string, number>() : undefined
  try {
    const mergedBytes = await mergeChunks(chunkBuffers, config.header ?? '', decorateOpts, anchorPageOut)

    // ── Phase 4: splice TOC pages with page numbers ─────────────────────────
    // Pass 1 already produced the final decorated PDF. Here we:
    //   1. Determine which pages are TOC pages
    //   2. Re-render only those pages with page numbers injected (jsdom + 1 small render)
    //   3. Splice the new pages into the merged PDF in place
    //   4. Decorate only the spliced pages (header/footer)
    if (process.env.BUILD_TOC_PAGENUMS && config.tocConfig && anchorPageOut && anchorPageOut.size > 0) {
      const tocRootId = config.tocConfig.rootId ?? 'toc-main'
      // Primary: look up the named destination Chrome emitted for the TOC root element.
      // Fallback: skipFirstPages tells us how many pre-TOC pages there are.
      const tocStartPage = anchorPageOut.get(tocRootId) ?? (config.bookmarksConfig?.skipFirstPages ?? 0) + 1

      let tocEndPage: number | undefined
      try {
        const tocJsonPath = path.join(outputPath, `$toc-${config.id}.json`)
        const tocItems: ITocItem[] = JSON.parse(await fs.readFile(tocJsonPath, 'utf8'))
        const pages = flattenTocIds(tocItems)
          .map((id) => anchorPageOut!.get(id))
          .filter((p): p is number => p !== undefined)
        if (pages.length > 0) {
          tocEndPage = Math.min(...pages) - 1
        }
      } catch {
        logger.debug('Could not load TOC JSON to determine TOC page range')
      }

      if (tocEndPage !== undefined && tocEndPage >= tocStartPage) {
        logger.info(chalk.gray(`Patching TOC pages ${tocStartPage}–${tocEndPage} with page numbers...`))

        // 1. Inject page numbers into the TOC links (in-process, no browser)
        const dom = new JSDOM(finalHtml)
        const tocRoot = dom.window.document.getElementById(tocRootId)
        if (tocRoot) {
          for (const a of tocRoot.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
            const anchorId = a.getAttribute('href')!.slice(1)
            if (anchorId === tocRootId) {
              continue
            } // skip the self-link sentinel
            const pageNum = anchorPageOut!.get(anchorId)
            if (pageNum !== undefined) {
              const span = dom.window.document.createElement('span')
              span.className = 'toc-page-num'
              span.textContent = String(pageNum)
              // Insert after .toc-dots but before any child <ul>, so flex-wrap
              // puts it on the same row as the label — not after the children.
              const dotsSpan = a.nextElementSibling
              a.parentElement!.insertBefore(span, dotsSpan?.nextElementSibling ?? null)
            }
          }
        }
        const patchedHtml = dom.serialize()

        // 2. Render only the TOC pages
        const tocBuffer = await renderChunk(patchedHtml, `${tocStartPage}-${tocEndPage}`, getCssPath(config))
        if (tocBuffer) {
          // 3. Splice new TOC pages into the merged PDF
          const mergedDoc = await PDFDocument.load(mergedBytes)
          const tocDoc = await PDFDocument.load(tocBuffer)

          // Remove old TOC pages in reverse order to keep indices stable
          for (let i = tocEndPage - 1; i >= tocStartPage - 1; i--) {
            mergedDoc.removePage(i)
          }

          // Insert the new TOC pages at the same position
          const tocPageCount = tocEndPage - tocStartPage + 1
          const newPages = await mergedDoc.copyPages(tocDoc, [...Array(tocPageCount).keys()])
          newPages.forEach((page, i) => mergedDoc.insertPage(tocStartPage - 1 + i, page))

          // 4. Decorate only the spliced pages (merged PDF is already decorated elsewhere)
          mergedDoc.registerFontkit(fontkit)
          const patchFont = await mergedDoc.embedFont(await fs.readFile(pageNumbersFontPath))
          decoratePagesInRange(mergedDoc, config.header ?? '', patchFont, tocStartPage, tocEndPage, decorateOpts)

          let phase4Bytes = await mergedDoc.save()
          if (config.usePdfBookmarks && anchorPageOut && anchorPageOut.size > 0) {
            const endPdfBookmarks = measure('Adding bookmarks to PDF')
            phase4Bytes = await applyOutlines(phase4Bytes, config, anchorPageOut)
            logger.info(chalk.gray(endPdfBookmarks()))
          }
          await fs.writeFile(outputFilenamePath, phase4Bytes)
          logger.info(chalk.gray(endMerge()))

          return
        }
      }
    }

    let outBytes
    if (config.usePdfBookmarks && anchorPageOut && anchorPageOut.size > 0) {
      const endPdfBookmarks = measure('Adding bookmarks to PDF')
      outBytes = await applyOutlines(mergedBytes, config, anchorPageOut)
      logger.info(chalk.gray(endPdfBookmarks()))
    } else {
      outBytes = mergedBytes
    }

    await fs.writeFile(outputFilenamePath, outBytes)
  } catch (err) {
    logger.error(err)

    return
  }

  logger.info(chalk.gray(endMerge()))
}

// ── Public entry point ───────────────────────────────────────────────────────

export const buildPdf = async (config: IDocumentConfig): Promise<void> => {
  logger.info(chalk.green(`Building PDF for "${config.documentTitle}" (${config.documentFileName})...`))

  const pdfCachePath = getPdfBuildPath(config)
  const releasePath = getReleasePath(config)
  const htmlChunksPath = getHtmlModuleBuildPath(config)
  const cssPath = getCssPath(config)

  const outputFilename = config.documentFileName!.replace('{{version}}', getBuildFileVersion(config))
  const outputFilenamePath = path.join(releasePath, outputFilename)
  const coverHtmlFile = config.coverHtmlFile ? `${config.coverHtmlFile}.html` : null
  const backCoverHtmlFile = config.backCoverHtmlFile ? `${config.backCoverHtmlFile}.html` : null

  try {
    await Promise.all([mkdir(pdfCachePath, { recursive: true }), mkdir(releasePath, { recursive: true })])

    const modulePath = htmlChunksPath
    const [coverContent, backCoverContent, cssContent] = await Promise.all([
      coverHtmlFile ? fs.readFile(path.join(modulePath, coverHtmlFile), 'utf8') : Promise.resolve(null),
      backCoverHtmlFile ? fs.readFile(path.join(modulePath, backCoverHtmlFile), 'utf8') : Promise.resolve(null),
      fs.readFile(cssPath, 'utf8').catch(() => ''),
    ])

    const sortedPages = await readModuleHtmlPages(modulePath, [coverHtmlFile, backCoverHtmlFile])

    // Compute content hashes for incremental build tracking.
    // Files are already in memory so this adds no I/O.
    const htmlFileOrder = [
      ...(coverHtmlFile ? [coverHtmlFile] : []),
      ...sortedPages.map(([name]) => name),
      ...(backCoverHtmlFile ? [backCoverHtmlFile] : []),
    ]
    const fileHashes: Record<string, string> = { __css__: hashContent(cssContent) }
    if (coverHtmlFile && coverContent) {
      fileHashes[coverHtmlFile] = hashContent(coverContent)
    }
    sortedPages.forEach(([name, content]) => {
      fileHashes[name] = hashContent(content)
    })
    if (backCoverHtmlFile && backCoverContent) {
      fileHashes[backCoverHtmlFile] = hashContent(backCoverContent)
    }

    // Fast path: when N and chunkSize are determinable without running the browser
    // and all chunks are cached with no file changes, skip Puppeteer entirely.
    // Disabled when BUILD_TOC_PAGENUMS is set — it needs anchorPageOut from the full pipeline.
    // anchorPageOut for bookmarks is populated by mergeChunks from cached PDFs without a browser.
    if (!process.env.BUILD_TOC_PAGENUMS) {
      const registry = await loadRegistry(pdfCachePath, config.id)
      const fastN = config.buildProcessesNum ?? registry?.N
      const fastChunkSize = config.buildPartSize ?? registry?.chunkSize
      if (fastN && fastChunkSize) {
        const plan = await resolveIncrementalPlan(
          pdfCachePath,
          config.id,
          htmlFileOrder,
          fileHashes,
          fastN,
          fastChunkSize,
        )
        if (plan.toRebuild.size === 0) {
          logger.info(chalk.gray(`All HTML unchanged — reusing ${fastN} cached chunks, skipping render`))
          const decorateOpts: IDecorateOptions = {
            skipHeaderAndFooter: config.skipHeaderAndFooter,
            skipHeader: config.skipHeader,
            skipFooter: config.skipFooter,
          }
          const cachedBuffers = Array.from({ length: fastN }, (_, i) => plan.cached.get(i)).filter(
            (b): b is Buffer => b !== undefined,
          )
          const anchorPageOut = config.usePdfBookmarks && config.tocConfig ? new Map<string, number>() : undefined
          const mergedBytes = await mergeChunks(cachedBuffers, config.header ?? '', decorateOpts, anchorPageOut)

          let outBytes: Uint8Array
          if (config.usePdfBookmarks && anchorPageOut && anchorPageOut.size > 0) {
            const endPdfBookmarks = measure('Adding bookmarks to PDF')
            outBytes = await applyOutlines(mergedBytes, config, anchorPageOut)
            logger.info(chalk.gray(endPdfBookmarks()))
          } else {
            outBytes = mergedBytes
          }

          await fs.writeFile(outputFilenamePath, outBytes)
          logger.info(chalk.green(`>> Generated PDF document for ${outputFilenamePath}`))

          return
        }
      }
    }

    const fullHtmlContent = assembleDocumentHtml(config, coverContent, sortedPages, backCoverContent)

    await createDocumentContentPdf(
      getFullPageTemplate(fullHtmlContent),
      outputFilenamePath,
      config,
      pdfCachePath,
      htmlChunksPath,
      {
        fileOrder: htmlFileOrder,
        fileHashes,
      },
    )

    logger.info(chalk.green(`>> Generated PDF document for ${outputFilenamePath}`))
  } catch (error) {
    const err = error as Error
    logger.error(err.stack)
    logger.error(chalk.red('>> Error during build:'))
    logger.error(err)
  }
}
