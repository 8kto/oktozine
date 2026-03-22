#!/bin/env node

import { mkdir } from 'node:fs/promises'

import fontkit from '@pdf-lib/fontkit'
import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import { PDFArray, PDFDict, PDFDocument, PDFFont, PDFName, PDFRef, rgb } from 'pdf-lib'
import puppeteer from 'puppeteer'
import { fileURLToPath } from 'url'

import { tocOverrides } from '../../conf/oktozin.toc.conf'
import packageConfig from '../../package.json' with { type: 'json' }
import { logger } from './lib/logger'
import { measure } from './lib/measure'
import { buildToc } from './lib/table-of-contents'
import { wrapContentSections } from './lib/wrap-sections'
import type { IPartProperties } from './types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const buildHtmlFolderPath = path.join(__dirname, '../../build/chunks-html')
const buildPdfFolderPath = path.join(__dirname, '../../build/pdf')
const cssPath = path.join(__dirname, '../../build/output.css')
const philosopherFontPath = path.join(__dirname, '../../src/styles/fonts/Philosopher/Philosopher-Regular.ttf')

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

const setupPage = async (browser: Awaited<ReturnType<typeof launchBrowser>>, html: string) => {
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

const renderChunkOnce = async (html: string, pageRange: string): Promise<Buffer> => {
  const browser = await launchBrowser()
  try {
    const page = await setupPage(browser, html)
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
const renderChunk = async (html: string, pageRange: string): Promise<Buffer | null> => {
  try {
    logger.debug(chalk.gray(`Rendering PDF chunk ${pageRange}`))

    return await renderChunkOnce(html, pageRange)
  } catch (err) {
    if ((err as Error)?.message.includes('Page range exceeds page count')) {
      return null
    }

    logger.debug(chalk.gray(`chunk ${pageRange}: retrying after error — ${(err as Error).message}`))
    return renderChunkOnce(html, pageRange)
  }
}

// ── HTML content helpers ─────────────────────────────────────────────────────

const getPageClassname = (moduleId: string, fileName: string): string => {
  const pageName = fileName.replace('.md.html', '').replace(/^\d+-/, '')

  return `page--wrapper page--${moduleId} page--${moduleId}-${pageName} page-name--${pageName}`
}

const getPageTemplate = (moduleId: string, fileName: string, pageContent: string, skipDelimiter = false): string => {
  return `<div class="${getPageClassname(moduleId, fileName)}">
    ${pageContent}
  </div>${skipDelimiter ? '' : '<div class="page-delimiter"></div>' + `<!-- ${fileName} -->`}`
}

const getFullPageTemplate = (content: string): string => {
  return `<div class="page-bg"></div><div class="full-content-container">${content}</div>`
}

const writeFullContentToFile = (id: string, content: string): void => {
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
  fs.writeFile(path.join(buildHtmlFolderPath, fileName), htmlPage)
  logger.info(chalk.bgBlueBright(`HTML dumped into "${fileName}" file`))
}

// ── PDF DOM preparation ──────────────────────────────────────────────────────

const buildTocForPage = async (page: Awaited<ReturnType<typeof setupPage>>, config: IPartProperties): Promise<void> => {
  if (!config.tocConfig) return

  try {
    const toc = await page.evaluate(buildToc, { ...config.tocConfig, tocOverrides })
    const rootId = config.tocConfig.rootId ?? 'toc-main'
    const tocHtml = await page.evaluate((id: string) => document.getElementById(id)?.innerHTML || '', rootId)
    fs.writeFile(path.join(buildHtmlFolderPath, `$toc-${config.id}.html`), tocHtml)
    fs.writeFile(path.join(__dirname, `../../build/$toc-${config.id}.json`), JSON.stringify(toc, null, 2))
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
const estimatePageCount = (page: Awaited<ReturnType<typeof setupPage>>, config: IPartProperties): Promise<number> => {
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
const preparePdfHtml = async (html: string, config: IPartProperties): Promise<IPreparedPdf | null> => {
  const browser = await launchBrowser()
  try {
    const page = await setupPage(browser, html)
    await injectNamePolyfill(page)
    await buildTocForPage(page, config)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.evaluate(wrapContentSections as any, { selector: '.content', wrapperClass: 'room-section' })

    const approxPageCount = await estimatePageCount(page, config)
    const finalHtml = await page.content()

    if (process.env.BUILD_DUMP_HTML !== 'false') {
      // FIXME use finalHtml?
      const body = await page.evaluate(() => document.body.innerHTML || '')
      writeFullContentToFile(config.id, body)
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
export const resolveChunkPlan = (config: IPartProperties, approxPageCount: number): IChunkPlan => {
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

// ── PDF page decoration ──────────────────────────────────────────────────────

const rgb255 = (r: number, g: number, b: number) => rgb(r / 255, g / 255, b / 255)

/** Draws a centered page number footer and a centered title header on every page. */
const decoratePdfPages = (mergedPdf: PDFDocument, headerText: string, font: PDFFont): void => {
  const grayColor = rgb255(137, 137, 137)
  const fontSize = 6 // 8px CSS ≈ 6pt in PDF (8 × 72/96)

  mergedPdf.getPages().forEach((page, i) => {
    const { width, height } = page.getSize()
    const pageNumStr = String(i + 1)

    // Footer: centered page number
    const numWidth = font.widthOfTextAtSize(pageNumStr, fontSize)
    page.drawText(pageNumStr, { x: (width - numWidth) / 2, y: 7, size: fontSize, font, color: grayColor })

    // Header: centered title
    const hdrWidth = font.widthOfTextAtSize(headerText, fontSize)
    page.drawText(headerText, { x: (width - hdrWidth) / 2, y: height - 13, size: fontSize, font, color: grayColor })
  })
}

const mergeChunks = async (chunkBuffers: Buffer[], headerText: string): Promise<Uint8Array> => {
  const mergedPdf = await PDFDocument.create()
  mergedPdf.registerFontkit(fontkit)
  const philosopherBytes = await fs.readFile(philosopherFontPath)
  const font = await mergedPdf.embedFont(philosopherBytes)

  const chunkMeta: Array<{ doc: PDFDocument; pageOffset: number; pageCount: number }> = []
  let pageOffset = 0

  for (const buf of chunkBuffers) {
    const doc = await PDFDocument.load(buf)
    const srcIndices = doc.getPageIndices()
    if (srcIndices.length === 0) continue // empty chunk (over-estimated page count)

    const copied = await mergedPdf.copyPages(doc, srcIndices)
    copied.forEach((p) => mergedPdf.addPage(p))

    chunkMeta.push({ doc, pageOffset, pageCount: srcIndices.length })
    pageOffset += srcIndices.length
  }

  const endRebuildNamedDestinations = measure('Rebuild PDF links')
  rebuildNamedDestinations(mergedPdf, chunkMeta)
  logger.info(chalk.gray(endRebuildNamedDestinations()))

  decoratePdfPages(mergedPdf, headerText, font)

  return mergedPdf.save()
}

// ── HTML file assembly helpers ───────────────────────────────────────────────

const isIncremented = (name: string): boolean => /-\d+\.md\.html$/.test(name)
const baseName = (name: string): string => name.replace(/-\d+\.md\.html$/, '.md.html')

/** Sorts HTML chunk files alphabetically; incremented variants (e.g. `-2.md.html`) sort after their base. */
export const compareHtmlFiles = (a: string, b: string): number => {
  const baseA = baseName(a)
  const baseB = baseName(b)
  if (baseA === baseB) {
    const incA = isIncremented(a)
    const incB = isIncremented(b)
    if (incA !== incB) return incA ? 1 : -1
  }

  return a.localeCompare(b)
}

/**
 * Reads and filters all HTML page files for a module, excluding cover/back-cover
 * and internal build artifacts (files prefixed with `$` or named `server.html`).
 * Returns sorted `[filename, content]` pairs.
 */
const readModuleHtmlPages = async (
  config: IPartProperties,
  excludeFiles: Array<string | null>,
): Promise<Array<[string, string]>> => {
  const moduleDir = path.join(buildHtmlFolderPath, `module-${config.id}`)
  const allFiles = await fs.readdir(moduleDir)
  const excluded = new Set(excludeFiles.filter((f): f is string => f !== null))

  const entries = await Promise.all(
    [...new Set(allFiles)].map(async (file): Promise<[string, string] | null> => {
      if (!file.endsWith('.html') || file.startsWith('$') || file === 'server.html' || excluded.has(file)) {
        return null
      }
      const content = await fs.readFile(path.join(moduleDir, file), 'utf8')
      return [file, content]
    }),
  )

  return entries.filter((x): x is [string, string] => x !== null).sort(([a], [b]) => compareHtmlFiles(a, b))
}

/** Concatenates cover, sorted page fragments, and back-cover into the full HTML body string. */
export const assembleDocumentHtml = (
  config: IPartProperties,
  coverContent: string | null,
  sortedPages: Array<[string, string]>,
  backCoverContent: string | null,
): string => {
  const coverFile = config.coverHtmlFile ? `${config.coverHtmlFile}.html` : null
  const backCoverFile = config.backCoverHtmlFile ? `${config.backCoverHtmlFile}.html` : null

  let html = ''

  if (coverFile && coverContent) {
    html += getPageTemplate(config.id, coverFile, coverContent, true)
  }

  sortedPages.forEach(([file, txt], index, arr) => {
    logger.debug(chalk.green(`>> PDF includes ${file}`))
    html += getPageTemplate(config.id, file, txt, index >= arr.length - 1)
  })

  if (backCoverFile && backCoverContent) {
    html += getPageTemplate(config.id, backCoverFile, backCoverContent, true)
  }

  return html
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

const createDocumentContentPdf = async (html: string, outputPath: string, config: IPartProperties): Promise<void> => {
  // ── Phase 1: DOM setup (TOC, section-wrap, page count, HTML serialisation) ─
  const endSetup = measure('Setup PDF doc: TOC, sections wrap...')
  const prepared = await preparePdfHtml(html, config)
  if (!prepared) return

  const { finalHtml, approxPageCount } = prepared
  const { N, chunkSize } = resolveChunkPlan(config, approxPageCount)
  logger.info(chalk.gray(`${endSetup()}, ~${approxPageCount} pages`))

  // ── Phase 2: parallel chunk rendering ─────────────────────────────────────
  const ranges = buildChunkRanges(N, chunkSize)
  logger.info(chalk.gray(`rendering ${N} (by ${chunkSize}) chunks in parallel: ${ranges.join(', ')}`))
  const endRender = measure('PDF render')

  let chunkBuffers: Buffer[]
  try {
    chunkBuffers = (await Promise.all(ranges.map((range) => renderChunk(finalHtml, range)))).filter(
      (b): b is Buffer => !!b,
    )
  } catch (err) {
    logger.error(err)
    return
  }

  logger.info(chalk.gray(endRender()))

  // ── Phase 3: merge + link repair + headers/footers ─────────────────────────
  const endMerge = measure('Merge PDF chunks')
  try {
    const mergedBytes = await mergeChunks(chunkBuffers, config.header ?? '')
    await fs.writeFile(outputPath, mergedBytes)
  } catch (err) {
    logger.error(err)
    return
  }

  logger.info(chalk.gray(endMerge()))
}

// ── Public entry point ───────────────────────────────────────────────────────

export const buildPdf = async (config: IPartProperties): Promise<void> => {
  logger.info(chalk.green(`Building PDF for "${config.documentTitle}" (${config.documentFileName})...`))

  const version = packageConfig.version
  const outputFilename = config.documentFileName!.replace('{{version}}', version)
  const outputFilenamePath = path.join(buildPdfFolderPath, outputFilename)
  const coverHtmlFile = config.coverHtmlFile ? `${config.coverHtmlFile}.html` : null
  const backCoverHtmlFile = config.backCoverHtmlFile ? `${config.backCoverHtmlFile}.html` : null

  try {
    await mkdir(buildPdfFolderPath, { recursive: true })

    const moduleDir = path.join(buildHtmlFolderPath, `module-${config.id}`)
    const [coverContent, backCoverContent] = await Promise.all([
      coverHtmlFile ? fs.readFile(path.join(moduleDir, coverHtmlFile), 'utf8') : Promise.resolve(null),
      backCoverHtmlFile ? fs.readFile(path.join(moduleDir, backCoverHtmlFile), 'utf8') : Promise.resolve(null),
    ])

    const sortedPages = await readModuleHtmlPages(config, [coverHtmlFile, backCoverHtmlFile])
    const fullHtmlContent = assembleDocumentHtml(config, coverContent, sortedPages, backCoverContent)

    await createDocumentContentPdf(getFullPageTemplate(fullHtmlContent), outputFilenamePath, config)

    logger.info(chalk.green(`>> Generated PDF document for ${outputFilenamePath}`))
  } catch (error) {
    const err = error as Error
    logger.error(err.stack)
    logger.error(chalk.red('>> Error during build:'))
    logger.error(err)
  }
}
