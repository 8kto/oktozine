/** @typedef {import('oktozine/types').IDocumentConfig} IDocumentConfig */
/** @typedef {import('oktozine/types').IModuleBuilderConfig} IModuleBuilderConfig */
/** @typedef {import('oktozine/types').ITocOverrides} ITocOverrides */

import { glueCrystalsAlike } from './custom-macros.mjs'

/** @type {ITocOverrides} */
const mainTocConf = {
  dropLabels: ['Зеница Варготара', 'Содержание'],
  dropItemsFromLabels: [
    'Приложение. Микомант',
    'Благодарности и техническая информация',
    'О модуле и как его водить',
    'Окружение и обитатели',
  ],
  alwaysInclude: ['Верёвочная лестница', 'Кристаллы', 'Грибы', 'Заклинания Микоманта'],
}

/** @type {ITocOverrides} */
const tocOverrides = {
  dropLabels: ['Содержание'],
  documents: {
    main: mainTocConf,
    osr: mainTocConf,
  },
}

const osrAliases = [[' : ', `: `]]

/** @type {Partial<IDocumentConfig>} */
const mainModuleConf = {
  id: 'main',
  documentTitle: 'Зеница Варготара',
  documentFileName: 'Зеница Варготара ({{version}}).pdf',
  header: 'Зеница Варготара',
  coverHtmlFile: '0000-front-cover-main.md',
  backCoverHtmlFile: '9999-back-cover.md',
  include: [],
  skipped: ['0405-appendix-q1--micomant--osr.md', '0405-appendix-q1--micomant--osr-1.md'],
  tocConfig: {
    headersSelector: 'h1:not([data-skip-toc]), h2:not([data-skip-toc]), h3, h4, h5',
    rootClassName: 'toc--main',
    renderMaxLevel: 2,
  },
  tocOverrides: tocOverrides,
  bookmarksConfig: {
    config: 'build/$toc-main.json',
    skipFirstPages: 3,
    skipLastPages: 1,
  },
  buildPartSize: 4,
  buildProcessesNum: 16,
  skipHeaderAndFooter: [-1, 1, 2, 3, 11, 15, 18, 27, 37, 47, 52, 58],
  skipFooter: [17, 23, 25, 36, 45, 55],
  macros: [glueCrystalsAlike],
}

/** @type {Partial<IDocumentConfig>} */
const mainBestiaryConf = {
  id: 'bestiary',
  documentTitle: 'Каталог Аномалий',
  documentFileName: 'Каталог Аномалий ({{version}}).pdf',
  header: 'Каталог Аномалий',
  skipped: [],
  includePattern: /front-cover-bestiary|title-bestiary|toc|notes-bestiary|bestiary|back-cover/,
  invalidateBuildOnPattern: /refs/,
  tocConfig: {
    headersSelector: 'h2:not([data-skip-toc]), .ref-header',
    rootClassName: 'toc--bestiary',
    renderMaxLevel: 5,
  },
  bookmarksConfig: {
    config: 'build/$toc-bestiary.json',
    skipFirstPages: 1,
  },
  buildPartSize: 8,
  buildProcessesNum: 3,
  skipHeaderAndFooter: [2],
}

// FIXME outputPath can be omitted here, but is required everywhere in the scripts
/** @type {IModuleBuilderConfig} */
const config = {
  version: '2',
  releaseDocumentIds: ['main', 'bestiary', 'map', 'osr', 'bestiary-osr'],
  template: 'two-columns.html',
  footer: '2025-2026, undefined Okto',
  header: 'Зеница Варготара',
  cssPath: 'build/output.css',
  invalidateBuildOnPattern: /\$refs-/,
  skipped: [
    '$refs-blocks.md',
    '$refs-stats.md',
    '$refs-items.md',
    '$notes.md',
    'server.html',
    '0000-front-cover-bestiary.md',
    '0005-title-map.md',
    '0005-title-bestiary.md',
    '0015-notes-bestiary.md',
    '0801-bestiary.md',
    '0199-grounds-map.md',
  ],
  referenceFiles: ['src/markdown/$refs-stats.md', 'src/markdown/$refs-items.md', 'src/markdown/$refs-blocks.md'],
  conditionalsAlias: {
    bestiary: 'main',
    'bestiary-osr': 'osr',
  },
  draftWatermarkHtml: '<strong>Черновая версия, не для распространения</strong>',
  chapterRefPattern: 'A-FPQS',
  tocConfig: {
    rootId: 'toc-main',
  },
  skipHeaderAndFooter: [1, -1], // skip first and last pages
  documents: [
    /** @type {IDocumentConfig} */ (mainModuleConf),
    /** @type {IDocumentConfig} */ ({
      ...mainModuleConf,
      id: 'osr',
      documentFileName: 'Зеница Варготара [OSR] ({{version}}).pdf',
      bookmarksConfig: {
        ...mainModuleConf.bookmarksConfig,
        config: 'build/$toc-osr.json',
      },
      skipped: ['0405-appendix-q1--micomant.md'],
      // fix after conditionals
      aliases: osrAliases,
    }),
    /** @type {IDocumentConfig} */ (mainBestiaryConf),
    /** @type {IDocumentConfig} */ ({
      ...mainBestiaryConf,
      id: 'bestiary-osr',
      documentFileName: 'Каталог Аномалий [OSR] ({{version}}).pdf',
      bookmarksConfig: {
        ...mainBestiaryConf.bookmarksConfig,
        config: 'build/$toc-bestiary-osr.json',
      },
      // fix after conditionals
      aliases: osrAliases,
    }),
    /** @type {IDocumentConfig} */ ({
      id: 'map',
      documentTitle: 'Карты Зеницы Варготара',
      documentFileName: 'Карты Зеницы Варготара ({{version}}).pdf',
      header: 'Карты Зеницы Варготара',
      include: [
        '0005-title-map.md',
        '0199-grounds-map.md',
        '0200-map.md',
        '0303-area-a-map.md',
        '0320-area-b-map.md',
        '0330-area-c-map.md',
        '0340-area-d-map.md',
        '0350-area-e-map.md',
        '0390-area-s-map.md',
        '9999-back-cover.md',
      ],
      invalidateBuildOnPattern: /area-.-map/,
      tocConfig: {
        headersSelector: 'h1:not([data-skip-toc]), h2:not([data-skip-toc])',
        rootClassName: 'toc--map',
        targetId: 'toc-map',
        renderMaxLevel: 2,
        hiddenToc: true,
      },
      bookmarksConfig: {
        config: 'build/$toc-map.json',
        skipFirstPages: 1,
      },
      skipHeaderAndFooter: [2, 3, 4, 5, 6, 7, 8, 9],
    }),
  ],
}

export default config
