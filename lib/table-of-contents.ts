/* eslint-env browser */

// import type is erased at compile time — safe for page.evaluate() serialization.
import type { ITocConfig, ITocItem, ITocOverrides } from '../types'

/**
 * Builds and renders a table of contents into the DOM.
 * This function is serialized and evaluated inside a Puppeteer browser context via page.evaluate().
 * ALL helpers must live inside this function body so they are included in the serialized source.
 */
export const buildToc = (conf?: ITocConfig): ITocItem[] => {
  function markTreeSkipped(item: ITocItem): void {
    item.$skipped = true
    if (Array.isArray(item.items)) {
      for (const child of item.items) {
        markTreeSkipped(child)
      }
    }
  }

  function markChildrenSkipped(item: ITocItem): void {
    if (!Array.isArray(item.items)) {
      return
    }
    for (const child of item.items) {
      markTreeSkipped(child)
    }
  }

  function overrideToc(data: ITocItem[], overrides: ITocOverrides = {}): ITocItem[] {
    const { dropLabels = [], dropItemsFromLabels = [] } = overrides

    for (const item of data) {
      if (dropLabels.includes(item.label)) {
        markTreeSkipped(item)
      }
    }

    for (const item of data) {
      if (dropItemsFromLabels.includes(item.label)) {
        markChildrenSkipped(item)
      }
    }

    return data
  }

  function applyRenderMaxLevel(data: ITocItem[], maxLevel: number | undefined): void {
    if (!(typeof maxLevel === 'number' && maxLevel > 0 && Number.isFinite(maxLevel))) {
      return
    }
    function walk(nodes: ITocItem[]): void {
      for (const n of nodes) {
        if (typeof n.$level === 'number' && n.$level > maxLevel!) {
          n.$skipped = true
        }
        if (Array.isArray(n.items)) {
          walk(n.items)
        }
      }
    }
    walk(data)
  }

  function getTocData({ headersSelector = 'h1, h2, h3' }: Pick<ITocConfig, 'headersSelector'> = {}): ITocItem[] {
    function slugify(el: HTMLElement, sfx: number): void {
      const slug = el
        .textContent!.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      el.id = `${slug || 'heading'}-${sfx}`
    }

    const headings = [...document.querySelectorAll<HTMLElement>(headersSelector)]
    headings.forEach((el, idx) => {
      if (!el.id) {
        slugify(el, idx)
      }
    })

    const tocData: ITocItem[] = []
    const dataStack: Array<{ level: number; items: ITocItem[] }> = [{ level: 0, items: tocData }]

    for (const el of headings) {
      const level = Number(el.tagName.charAt(1))

      while (dataStack.length && dataStack[dataStack.length - 1].level >= level) {
        dataStack.pop()
      }

      const parentItems = dataStack[dataStack.length - 1].items
      const node: ITocItem = {
        label: (el.textContent || '').trim(),
        id: el.id,
        items: [],
        $level: level,
      }

      parentItems.push(node)
      dataStack.push({ level, items: node.items! })
    }

    return tocData
  }

  function renderToc(
    tocData: ITocItem[],
    {
      rootClassName,
      targetId = 'toc-main',
      tocOverrides,
      pageNumbers,
      hiddenToc,
    }: Pick<ITocConfig, 'rootClassName' | 'targetId' | 'tocOverrides' | 'pageNumbers' | 'hiddenToc'> = {},
  ): void {
    const alwaysInclude = new Set(tocOverrides?.alwaysInclude ?? [])

    function createList(items: ITocItem[], visualDepth = 1): HTMLUListElement {
      const ul = document.createElement('ul')
      ul.classList.add(`list-level-${visualDepth}`)

      for (const item of items) {
        const isSkipped = !!item.$skipped
        const forceShow = alwaysInclude.has(item.label)
        if (isSkipped && !forceShow) {
          continue
        }

        const li = document.createElement('li')
        const a = document.createElement('a')
        a.href = `#${item.id}`
        a.classList.add(`level-${visualDepth}`)

        const labelSpan = document.createElement('span')
        labelSpan.className = 'toc-label'
        labelSpan.textContent = item.label
        a.appendChild(labelSpan)

        li.appendChild(a)

        const dotsSpan = document.createElement('span')
        dotsSpan.className = 'toc-dots'
        li.appendChild(dotsSpan)

        const pageNum = item.id ? pageNumbers?.[item.id] : undefined
        if (pageNum !== undefined) {
          const pageSpan = document.createElement('span')
          pageSpan.className = 'toc-page-num'
          pageSpan.textContent = String(pageNum)
          li.appendChild(pageSpan)
          // } else {
          //   // DEBUG
          //   // li.removeChild(document.querySelector('.toc-page-num')!)
          //   const pageSpan = document.createElement('span')
          //   pageSpan.className = 'toc-page-num'
          //   pageSpan.textContent = String('99')
          //   li.appendChild(pageSpan)
        }

        const hasChildren = Array.isArray(item.items) && item.items.length > 0
        if (hasChildren) {
          const childList = createList(item.items!, visualDepth + 1)
          if (childList.children.length > 0) {
            li.appendChild(childList)
          }
        }

        ul.appendChild(li)
      }

      return ul
    }

    const tocNav = document.createElement('nav')
    tocNav.classList.add('toc-nav')
    if (rootClassName) {
      tocNav.classList.add(rootClassName)
    }

    tocNav.appendChild(createList(tocData, 1))

    const tocRoot = document.getElementById(targetId)
    if (tocRoot) {
      tocRoot.appendChild(tocNav)
      if (hiddenToc) {
        tocRoot.classList.add('hidden')
      }

      // A link pointing to the TOC root causes Chrome to emit a named destination
      // for it in /Catalog/Dests, letting us locate the TOC start page precisely.
      // Appended to <body> (not inside the TOC) so it has zero layout impact.
      const tocAnchor = document.createElement('a')
      tocAnchor.href = `#${targetId}`
      tocAnchor.style.cssText = 'position:fixed;left:-9999px;opacity:0'
      document.body.appendChild(tocAnchor)
    }
  }

  const tocData = getTocData(conf)
  const afterDrops = overrideToc(tocData, conf?.tocOverrides)
  applyRenderMaxLevel(afterDrops, conf?.renderMaxLevel)
  renderToc(afterDrops, conf)

  const alwaysIncludeSet = new Set(conf?.tocOverrides?.alwaysInclude ?? [])

  function stripInternals(items: ITocItem[]): ITocItem[] {
    return items
      .filter((item) => !item.$skipped || alwaysIncludeSet.has(item.label))
      .map(({ $level: _l, $skipped: _s, items: children, ...rest }) => ({
        ...rest,
        items: children ? stripInternals(children) : children,
      }))
  }

  return stripInternals(afterDrops)
}
