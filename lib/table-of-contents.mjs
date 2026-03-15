/* eslint-env browser */

/**
 * @typedef {{ label: string, id?: string, items?: Array<TocItem>, $skipped?: boolean, $level?: number }} TocItem
 * @typedef {{
 *   headersSelector?: string,
 *   rootClassName?: string,
 *   targetId?: string,
 *   renderMaxLevel?: number, // if set, nodes deeper than this level are marked $skipped=true
 *   tocOverrides?: {
 *     dropLabels?: string[],
 *     dropItemsFromLabels?: string[],
 *     alwaysInclude?: string[], // labels that must render even if $skipped
 *   }
 * }} TocConfig
 */

/**
 * @param {TocConfig} [conf]
 */
export const buildToc = (conf) => {
  /**
   * Recursively mark an item (and all descendants) as skipped.
   * @param {TocItem} item
   */
  const markTreeSkipped = (item) => {
    item.$skipped = true
    if (Array.isArray(item.items)) {
      for (const child of item.items) {
        markTreeSkipped(child)
      }
    }
  }

  /**
   * Recursively mark all descendants of an item as skipped (but not the item itself).
   * @param {TocItem} item
   */
  const markChildrenSkipped = (item) => {
    if (!Array.isArray(item.items)) {
      return
    }
    for (const child of item.items) {
      markTreeSkipped(child)
    }
  }

  /**
   * Apply "drop" rules by setting $skipped flags instead of deleting nodes.
   * - dropLabels: mark entire top-level item trees as skipped
   * - dropItemsFromLabels: keep the top-level item but mark all of its descendants as skipped
   *
   * @param {TocItem[]} data
   * @param {TocConfig['tocOverrides']} conf
   * @returns {TocItem[]}
   */
  const overrideToc = (data, conf = {}) => {
    const { dropLabels = [], dropItemsFromLabels = [] } = conf

    // 1) Mark entire top-level sections by label as skipped
    for (const item of data) {
      if (dropLabels.includes(item.label)) {
        markTreeSkipped(item)
      }
    }

    // 2) Keep the parent but skip all its descendants
    for (const item of data) {
      if (dropItemsFromLabels.includes(item.label)) {
        markChildrenSkipped(item)
      }
    }

    return data
  }

  /**
   * Mark nodes as $skipped if their $level > renderMaxLevel.
   * NOTE: We still mark as $skipped (to preserve state in returned data), but
   * render can force-include specific labels via alwaysInclude.
   * @param {TocItem[]} data
   * @param {number|undefined} maxLevel
   */
  const applyRenderMaxLevel = (data, maxLevel) => {
    if (!(typeof maxLevel === 'number' && maxLevel > 0 && Number.isFinite(maxLevel))) {
      return
    }
    const walk = (nodes) => {
      for (const n of nodes) {
        if (typeof n.$level === 'number' && n.$level > maxLevel) {
          n.$skipped = true
        }
        if (Array.isArray(n.items)) {
          walk(n.items)
        }
      }
    }
    walk(data)
  }

  /**
   * Collects headings from the document and returns structured TOC data.
   * Adds $level to each node matching actual heading level (H1=1..H6=6).
   * @param {TocConfig} [config]
   * @returns {TocItem[]}
   */
  const getTocData = ({ headersSelector = 'h1, h2, h3' } = {}) => {
    const slugify = (el, sfx) => {
      const slug = el.textContent
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      el.id = `${slug || 'heading'}-${sfx}`
    }

    const headings = /** @type {HTMLElement[]} */ ([...document.querySelectorAll(headersSelector)])
    headings.forEach((el, idx) => {
      if (!el.id) {
        slugify(el, idx)
      }
    })

    /** @type {TocItem[]} */
    const tocData = []
    const dataStack = [{ level: 0, items: tocData }]

    for (const el of headings) {
      const level = Number(el.tagName.charAt(1)) // 1..6

      while (dataStack.length && dataStack[dataStack.length - 1].level >= level) {
        dataStack.pop()
      }

      const parentItems = dataStack[dataStack.length - 1].items
      const node = {
        label: (el.textContent || '').trim(),
        id: el.id,
        items: [],
        $level: level,
      }

      parentItems.push(node)
      dataStack.push({ level, items: node.items })
    }

    return tocData
  }

  /**
   * Renders a nested TOC list into the DOM from TOC data.
   * Skips any item where $skipped === true, UNLESS its label is in alwaysInclude.
   * Also implicitly skips nodes deeper than renderMaxLevel because those were marked $skipped.
   * @param {TocItem[]} tocData
   * @param {TocConfig} [config]
   */
  const renderToc = (tocData, { rootClassName, targetId = 'toc-main', renderMaxLevel, tocOverrides } = {}) => {
    const alwaysInclude = new Set(tocOverrides?.alwaysInclude ?? [])

    /**
     * Create a list element from items, ignoring $skipped nodes unless forced by alwaysInclude.
     * Visual CSS classes keep depth-based styling, independent of heading levels.
     * @param {TocItem[]} items
     * @param {number} visualDepth
     * @returns {HTMLElement}
     */
    const createList = (items, visualDepth = 1) => {
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
        a.textContent = item.label
        a.classList.add(`level-${visualDepth}`)
        li.appendChild(a)

        const hasChildren = Array.isArray(item.items) && item.items.length > 0
        if (hasChildren) {
          const childList = createList(item.items, visualDepth + 1)
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
    }
  }

  // Build raw tree
  const tocData = getTocData(conf)
  // Apply drop rules ($skipped)
  const afterDrops = overrideToc(tocData, conf?.tocOverrides)
  // Apply renderMaxLevel by marking nodes as $skipped when deeper than allowed
  applyRenderMaxLevel(afterDrops, conf?.renderMaxLevel)
  // Render; alwaysInclude can force rendering even when $skipped
  renderToc(afterDrops, conf)

  return afterDrops
}
