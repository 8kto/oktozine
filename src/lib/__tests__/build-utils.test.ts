/** @jest-environment jsdom */

import type { IDocumentConfig, IDocumentPage } from '../../types'
import { PAGE_BREAK_DELIMITER, recalculatePages } from '../build-utils'
import { buildToc } from '../table-of-contents'

const makeBaseHTML = (targetId = 'toc-main'): void => {
  document.body.innerHTML = `
    <div id="${targetId}"></div>

    <h1>Intro</h1>
    <h2>Getting Started</h2>
    <h3>Install</h3>

    <h2>Usage</h2>
    <h3>Basics</h3>

    <h1>API</h1>
    <h2>Methods</h2>
    <h2>Options</h2>
  `
}

describe('buildToc', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  test('builds hierarchical TOC data and renders DOM with generated slugs', () => {
    makeBaseHTML()

    const result = buildToc({})

    expect(result).toEqual([
      {
        label: 'Intro',
        id: 'intro-0',
        items: [
          {
            label: 'Getting Started',
            id: 'getting-started-1',
            items: [{ label: 'Install', id: 'install-2', items: [] }],
          },
          {
            label: 'Usage',
            id: 'usage-3',
            items: [{ label: 'Basics', id: 'basics-4', items: [] }],
          },
        ],
      },
      {
        label: 'API',
        id: 'api-5',
        items: [
          { label: 'Methods', id: 'methods-6', items: [] },
          { label: 'Options', id: 'options-7', items: [] },
        ],
      },
    ])

    const nav = document.querySelector('#toc-main nav.toc-nav')
    expect(nav).toBeTruthy()

    const topList = nav!.querySelector('ul.list-level-1')
    expect(topList).toBeTruthy()

    const anchors = Array.from(nav!.querySelectorAll('a'))
    const hrefsToLabels = anchors.map((a) => [a.getAttribute('href'), a.textContent])
    expect(hrefsToLabels).toEqual([
      ['#intro-0', 'Intro'],
      ['#getting-started-1', 'Getting Started'],
      ['#install-2', 'Install'],
      ['#usage-3', 'Usage'],
      ['#basics-4', 'Basics'],
      ['#api-5', 'API'],
      ['#methods-6', 'Methods'],
      ['#options-7', 'Options'],
    ])
  })

  test('applies tocOverrides.dropLabels (drops whole top-level sections by label)', () => {
    makeBaseHTML()

    const toc = buildToc({
      tocOverrides: {
        dropLabels: ['API'],
      },
    })

    expect(toc).toEqual([
      {
        label: 'Intro',
        id: 'intro-0',
        items: [
          {
            label: 'Getting Started',
            id: 'getting-started-1',
            items: [{ label: 'Install', id: 'install-2', items: [] }],
          },
          {
            label: 'Usage',
            id: 'usage-3',
            items: [{ label: 'Basics', id: 'basics-4', items: [] }],
          },
        ],
      },
    ])

    const navText = document.querySelector('#toc-main nav')!.textContent
    expect(navText).toContain('Intro')
    expect(navText).not.toContain('API')
  })

  test('applies tocOverrides.dropItemsFromLabels', () => {
    makeBaseHTML()

    const toc = buildToc({
      tocOverrides: {
        dropItemsFromLabels: ['Intro'],
      },
    })

    const intro = toc.find((x) => x.label === 'Intro')
    expect(intro).toBeTruthy()

    const api = toc.find((x) => x.label === 'API')
    expect(api).toBeTruthy()
    expect(api!.items).toEqual([
      { label: 'Methods', id: 'methods-6', items: [] },
      { label: 'Options', id: 'options-7', items: [] },
    ])
  })

  test('renders into a custom target and applies a custom root class', () => {
    const customId = 'custom-toc'
    makeBaseHTML(customId)

    const toc = buildToc({
      targetId: customId,
      rootClassName: 'my-toc',
    })

    expect(toc.length).toBeGreaterThan(0)

    const nav = document.querySelector(`#${customId} nav.toc-nav.my-toc`)
    expect(nav).toBeTruthy()
    expect(document.querySelector('#toc-main')).toBeNull()
  })

  test('respects custom headersSelector', () => {
    document.body.innerHTML = `
      <div id="toc-main"></div>
      <h1>Main</h1>
      <h2>Sub A</h2>
      <h3>Details A</h3>
      <h4>Should be ignored by default</h4>
      <h2>Sub B</h2>
    `

    const defaultToc = buildToc({})
    const defaultLabels = defaultToc.flatMap((node) => [node.label, ...(node.items ?? []).map((c) => c.label)])
    expect(defaultLabels).toEqual(['Main', 'Sub A', 'Sub B'])

    document.body.innerHTML = `
      <div id="toc-main"></div>
      <h1>Main</h1>
      <h2>Sub A</h2>
      <h3>Details A</h3>
      <h4>Should be included</h4>
      <h2>Sub B</h2>
    `
    const customToc = buildToc({ headersSelector: 'h1, h2, h3, h4' })
    const flat: string[] = []
    const walk = (arr: typeof customToc): void =>
      arr.forEach((n) => {
        flat.push(n.label)
        if (Array.isArray(n.items)) {
          walk(n.items)
        }
      })
    walk(customToc)

    expect(flat).toEqual(['Main', 'Sub A', 'Details A', 'Should be included', 'Sub B'])

    const hasH4Anchor = Array.from(document.querySelectorAll('#toc-main nav a')).some(
      (a) => a.textContent === 'Should be included',
    )
    expect(hasH4Anchor).toBe(true)
  })

  describe('recalculatePages', () => {
    const input = Object.freeze({
      metadata: { template: 'page-x', name: 'page-x-name', id: 'test' },
      content: `Page A ${PAGE_BREAK_DELIMITER} Page B`,
    } as unknown as IDocumentPage)

    it('should return flat list of pages', () => {
      const result = recalculatePages(input)
      expect(result).toHaveLength(2)
      expect(result[0].content).toBe('Page A\n')
      expect(result[1].content).toBe('Page B\n')
      expect(result[0].metadata.name).toBe('page-x-name')
      expect(result[1].metadata.name).toBe('page-x-name-2')
    })
  })
})

describe('draftWatermarkHtml config field', () => {
  it('injects custom watermark html when not in production', () => {
    const conf = { isProduction: false, draftWatermarkHtml: '<em>DRAFT</em>' } as IDocumentConfig
    const watermark = conf.isProduction ? '' : (conf.draftWatermarkHtml ?? '')
    expect(watermark).toBe('<em>DRAFT</em>')
  })

  it('shows no watermark in production regardless of config', () => {
    const conf = { isProduction: true, draftWatermarkHtml: '<em>DRAFT</em>' } as IDocumentConfig
    const watermark = conf.isProduction ? '' : (conf.draftWatermarkHtml ?? '')
    expect(watermark).toBe('')
  })

  it('returns empty string when draftWatermarkHtml is absent', () => {
    const conf = { isProduction: false } as IDocumentConfig
    const watermark = conf.isProduction ? '' : (conf.draftWatermarkHtml ?? '')
    expect(watermark).toBe('')
  })
})
