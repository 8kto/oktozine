/** @jest-environment jsdom */

import { PAGE_BREAK_DELIMITER, recalculatePages } from '../build-utils.mjs'

import { buildToc } from '../table-of-contents.mjs'

const makeBaseHTML = (targetId = 'toc-main') => {
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
    // Fresh DOM for every test
    document.body.innerHTML = ''
  })

  test('builds hierarchical TOC data and renders DOM with generated slugs', () => {
    makeBaseHTML() // default #toc-main present

    const result = buildToc({})

    // Exact IDs are deterministic because slugify uses text + NodeList index suffix
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

    // DOM render checks
    const nav = document.querySelector('#toc-main nav.toc-nav')
    expect(nav).toBeTruthy()

    // top-level UL and anchors present
    const topList = nav.querySelector('ul.list-level-1')
    expect(topList).toBeTruthy()

    // verify anchors map to correct ids and labels
    const anchors = Array.from(nav.querySelectorAll('a'))
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

    // Only "Intro" subtree remains
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

    // DOM contains no "API"
    const navText = document.querySelector('#toc-main nav').textContent

    expect(navText).toContain('Intro')
    expect(navText).not.toContain('API')
  })

  test('applies tocOverrides.dropItemsFromLabels (removes all children from specific top-level labels)', () => {
    makeBaseHTML()

    const toc = buildToc({
      tocOverrides: {
        dropItemsFromLabels: ['Intro'],
      },
    })

    // "Intro" must be present without any items property (or as empty)
    const intro = toc.find((x) => x.label === 'Intro')
    expect(intro).toBeTruthy()
    // items property should be removed by implementation (not just empty)
    expect('items' in intro).toBe(false)

    // "API" subtree still intact
    const api = toc.find((x) => x.label === 'API')
    expect(api).toBeTruthy()
    expect(api.items).toEqual([
      { label: 'Methods', id: 'methods-6', items: [] },
      { label: 'Options', id: 'options-7', items: [] },
    ])

    // DOM should not show Intro's children
    const nav = document.querySelector('#toc-main nav')
    const introLi = Array.from(nav.querySelectorAll('a'))
      .find((a) => a.textContent === 'Intro')
      .closest('li')

    expect(introLi.querySelector('ul')).toBeNull()
  })

  test('applies tocOverrides.dropSubLabels (removes selected child labels under a given parent id)', () => {
    makeBaseHTML()

    const toc = buildToc({
      tocOverrides: {
        // Parent is top-level "Intro" with id "intro-0"
        dropSubLabels: {
          'intro-0': ['Usage'], // remove the "Usage" subsection under Intro
        },
      },
    })

    const intro = toc.find((x) => x.id === 'intro-0')
    !(
      // "Getting Started" remains, "Usage" removed
      expect(intro.items).toEqual([
        {
          label: 'Getting Started',
          id: 'getting-started-1',
          items: [{ label: 'Install', id: 'install-2', items: [] }],
        },
      ])
    )

    // DOM should not contain "Usage"
    const navText = document.querySelector('#toc-main nav').textContent
    expect(navText).toContain('Getting Started')
    expect(navText).not.toContain('Usage')
  })

  test('renders into a custom target and applies a custom root class', () => {
    const customId = 'custom-toc'
    makeBaseHTML(customId) // create <div id="custom-toc">

    const toc = buildToc({
      targetId: customId,
      rootClassName: 'my-toc',
    })

    expect(toc.length).toBeGreaterThan(0)

    const nav = document.querySelector(`#${customId} nav.toc-nav.my-toc`)
    expect(nav).toBeTruthy()
    // Ensure nothing was appended to default #toc-main (which doesn't exist here)
    expect(document.querySelector('#toc-main')).toBeNull()
  })

  test('throws a clear error if target element is missing', () => {
    makeBaseHTML() // only #toc-main exists
    expect(() => buildToc({ targetId: 'does-not-exist' })).toThrow('Элемент #does-not-exist не найден в документе')
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

    // Default selector: 'h1, h2, h3' — the h4 is ignored
    const defaultToc = buildToc({})
    const defaultLabels = defaultToc.flatMap((node) => [node.label, ...(node.items ?? []).map((c) => c.label)])
    expect(defaultLabels).toEqual(['Main', 'Sub A', 'Sub B'])

    // Now include h4 with a custom selector
    document.body.innerHTML = `
      <div id="toc-main"></div>
      <h1>Main</h1>
      <h2>Sub A</h2>
      <h3>Details A</h3>
      <h4>Should be included</h4>
      <h2>Sub B</h2>  
    `
    const customToc = buildToc({ headersSelector: 'h1, h2, h3, h4' })
    const flat = []
    const walk = (arr) =>
      arr.forEach((n) => {
        flat.push(n.label)
        if (Array.isArray(n.items)) {
          walk(n.items)
        }
      })
    walk(customToc)

    expect(flat).toEqual(['Main', 'Sub A', 'Details A', 'Should be included', 'Sub B'])

    // Also verify DOM contains an anchor to the h4
    const hasH4Anchor = Array.from(document.querySelectorAll('#toc-main nav a')).some(
      (a) => a.textContent === 'Should be included',
    )
    expect(hasH4Anchor).toBe(true)
  })

  describe('recalculatePages', () => {
    /** @var {DocPage} */
    const input = Object.freeze({
      metadata: { template: 'page-x', name: 'page-x-name' },
      content: `Page A ${PAGE_BREAK_DELIMITER} Page B`,
    })

    it('should return flat list of strings', () => {
      expect(recalculatePages(input)).toEqual([
        {
          content: 'Page A\n',
          metadata: {
            template: 'page-x',
            name: 'page-x-name',
          },
        },
        {
          content: 'Page B\n',
          metadata: {
            template: 'page-x',
            name: 'page-x-name-2',
          },
        },
      ])
    })
  })
})
