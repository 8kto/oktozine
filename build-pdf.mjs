#!/bin/env node

import { mkdir } from 'node:fs/promises'

import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import puppeteer from 'puppeteer'
import { fileURLToPath } from 'url'

import { tocOverrides } from '../../conf/oktozin.toc.conf.mjs'
import packageConfig from '../../package.json' with { type: 'json' }
import { logger } from './lib/logger.mjs'
import { buildToc } from './lib/table-of-contents.mjs'
import { wrapContentSections } from './lib/wrap-sections.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const baseIncludesPath = `${__dirname}/../../src`
const buildHtmlFolderPath = path.join(__dirname, '../../build/chunks-html')
const buildPdfFolderPath = path.join(__dirname, '../../build/pdf')
const cssPath = path.join(__dirname, '../../build/output.css') // used by addStyleTag

/**
 * @param {string} html
 * @param {string} outputPath
 * @param {PartProperties} config
 * @param {{ headerTemplate: string, footerTemplate: string }} templates
 * @returns {Promise<void>}
 */
const createDocumentContentPdf = async (html, outputPath, config, { headerTemplate, footerTemplate }) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: null, // Otherwise it defaults to 800x600
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-fullscreen', '--lang=ru-RU,ru', '--disable-translate'],
  })

  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  })

  // Redirect logs from browser page to the console
  page.on('console', (msg) => {
    // eslint-disable-next-line no-console
    logger.info(`PAGE LOG: ${msg.text()}`)
  })
  page.on('requestfailed', (request) => {
    logger.error(`Failed request URL: ${request.url()} Reason: ${request.failure().errorText}`)
  })

  try {
    await page.setViewport({ width: 1280, height: 720 })
    await page.setContent(html, { waitUntil: 'networkidle0' }) // Wait for no in-flight network requests
    await page.addStyleTag({ path: cssPath })

    // Ensure all fonts are loaded
    await page.evaluateHandle('document.fonts.ready')

    if (config.tocConfig) {
      try {
        const toc = await page.evaluate(buildToc, { ...config.tocConfig, tocOverrides })
        const elementHandle = await page.$(`#${toc.rootId}`)
        const tocHtml = await page.evaluate((id) => document.getElementById(id)?.innerHTML || '', toc.rootId)
        await elementHandle?.dispose()

        fs.writeFile(path.join(buildHtmlFolderPath, `$toc-${config.id}.html`), tocHtml)
        fs.writeFile(path.join(__dirname, `../../build/$toc-${config.id}.json`), JSON.stringify(toc, null, 2))
      } catch (err) {
        console.debug('build-pdf: cannot create TOC', err)
      }
    }

    await page.evaluate(wrapContentSections, { selector: '.content', wrapperClass: 'room-section' })

    await page.emulateMediaType('print')

    // Generate PDF
    await page.pdf({
      path: outputPath,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: headerTemplate.replace('{{header}}', config.header),
      footerTemplate: footerTemplate.replace('{{footer}}', config.footer),
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      scale: 1,
    })

    // Debug: dump final HTML to file. Enable with BUILD_DUMP_HTML=1.
    if (process.env.BUILD_DUMP_HTML) {
      const htmlPageContent = await page.evaluate(() => document.body.innerHTML || '')
      writeFullContentToFile(config.id, htmlPageContent)
    }
  } catch (err) {
    logger.error(err)
  } finally {
    await browser.close()
  }
}

/**
 * @param {string} moduleId
 * @param {string} fileName
 * @returns {string}
 */
const getPageClassname = (moduleId, fileName) => {
  const pageName = fileName.replace('.md.html', '').replace(/^\d+-/, '')

  return `page--wrapper page--${moduleId} page--${moduleId}-${pageName} page-name--${pageName}`
}

/**
 * @param {string} moduleId
 * @param {string} fileName
 * @param {string} pageContent
 * @param {boolean} skipDelimiter
 * @returns {string}
 */
const getPageTemplate = (moduleId, fileName, pageContent, skipDelimiter = false) => {
  const fullHtmlContent = `<div class="${getPageClassname(moduleId, fileName)}">
    ${pageContent}
  </div>${skipDelimiter ? '' : '<div class="page-delimiter"></div>' + `<!-- ${fileName} -->`}`

  return fullHtmlContent
}

/**
 * @param {string} content
 * @returns {string}
 */
const getFullPageTemplate = (content) => {
  return `<div class="page-bg"></div><div class="full-content-container">${content}</div>`
}

/**
 * @param {string} id
 * @param {string} content
 */
const writeFullContentToFile = (id, content) => {
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

const isIncremented = (name) => /-\d+\.md\.html$/.test(name)

const baseName = (name) => name.replace(/-\d+\.md\.html$/, '.md.html')

/**
 * @param {PartProperties} config
 * @returns {Promise<void>}
 */
export const buildPdf = async (config) => {
  logger.info(chalk.green(`Building PDF for "${config.documentTitle}" (${config.documentFileName})...`))

  const version = packageConfig.version
  const outputFilename = config.documentFileName.replace('{{version}}', version)
  const outputFilenamePath = path.join(buildPdfFolderPath, outputFilename)
  const coverHtmlFile = config.coverHtmlFile ? `${config.coverHtmlFile}.html` : null
  const backCoverHtmlFile = config.backCoverHtmlFile ? `${config.backCoverHtmlFile}.html` : null

  try {
    await mkdir(buildPdfFolderPath, { recursive: true })

    const coverHtmlPath = coverHtmlFile ? path.join(buildHtmlFolderPath, `module-${config.id}`, coverHtmlFile) : null
    const backCoverHtmlPath = backCoverHtmlFile
      ? path.join(buildHtmlFolderPath, `module-${config.id}`, backCoverHtmlFile)
      : null

    // Read all independent inputs in one parallel batch before touching the browser.
    const [coverContent, backCoverContent, htmlFiles, templateHeader, templateFooter] = await Promise.all([
      coverHtmlPath ? fs.readFile(coverHtmlPath, 'utf8') : Promise.resolve(null),
      backCoverHtmlPath ? fs.readFile(backCoverHtmlPath, 'utf8') : Promise.resolve(null),
      fs.readdir(`${buildHtmlFolderPath}/module-${config.id}`),
      fs.readFile(`${baseIncludesPath}/html/fragments/header.html`, 'utf-8'),
      fs.readFile(`${baseIncludesPath}/html/fragments/footer.html`, 'utf-8'),
    ])

    let fullHtmlContent = ''
    if (coverHtmlFile) {
      fullHtmlContent += getPageTemplate(config.id, coverHtmlFile, coverContent, true)
    }

    const filteredFiles = htmlFiles.filter((f) => coverHtmlFile !== f && backCoverHtmlFile !== f && f !== 'server.html')

    const processes = [...new Set(filteredFiles)].map(async (file) => {
      if (!file.endsWith('.html') || file.startsWith('$fullHtmlContent-') || file.startsWith('$toc-')) {
        return
      }

      const content = await fs.readFile(path.join(buildHtmlFolderPath, `module-${config.id}`, file), 'utf8')

      return [file, content]
    })

    const content = await Promise.all(processes)
    content
      .filter(Boolean)
      .sort(([a], [b]) => {
        const baseA = baseName(a)
        const baseB = baseName(b)

        if (baseA === baseB) {
          const incA = isIncremented(a)
          const incB = isIncremented(b)

          if (incA !== incB) {
            return incA ? 1 : -1
          }
        }

        return a.localeCompare(b)
      })
      .forEach(([file, txt], index, arr) => {
        logger.debug(chalk.green(`>> PDF includes ${file}`))

        const skipDelimiterForLastFile = index >= arr.length - 1
        fullHtmlContent += getPageTemplate(config.id, file, txt, skipDelimiterForLastFile)
      })

    if (backCoverHtmlFile) {
      fullHtmlContent += getPageTemplate(config.id, backCoverHtmlFile, backCoverContent, true)
    }

    await createDocumentContentPdf(getFullPageTemplate(fullHtmlContent), outputFilenamePath, config, {
      headerTemplate: templateHeader,
      footerTemplate: templateFooter,
    })

    logger.info(chalk.green(`>> Generated PDF document for ${outputFilenamePath}`))
  } catch (error) {
    logger.error(error.stack)
    logger.error(chalk.red('>> Error during build:'))
    logger.error(error)
  }
}
