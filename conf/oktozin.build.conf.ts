import type { IModuleBuilderConfig, IPartProperties } from '../scripts/oktozine/types'

const mainModuleConf: Partial<IPartProperties> = {
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
  bookmarksConfig: {
    config: 'build/$toc-main.json',
    skipFirstPages: 3,
    skipLastPages: 1,
  },
  buildPartSize: 8,
  buildProcessesNum: 8,
}

const mainBestiaryConf: Partial<IPartProperties> = {
  id: 'bestiary',
  documentTitle: 'Каталог Аномалий',
  documentFileName: 'Каталог Аномалий ({{version}}).pdf',
  header: 'Каталог Аномалий',
  skipped: [],
  referenceFiles: ['src/markdown/$refs-stats.md'],
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
  skipBuild: true,
  buildPartSize: 8,
  buildProcessesNum: 3,
}

const config: IModuleBuilderConfig = {
  releasePartIds: ['main', 'bestiary', 'map', 'osr', 'bestiary-osr'],
  template: 'two-columns.html',
  footer: '2025-2026, undefined Okto',
  header: 'Зеница Варготара',
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
    '0800-bestiary--autogen.md',
    '0199-grounds-map.md',
  ],
  referenceFiles: ['src/markdown/$refs-stats.md', 'src/markdown/$refs-items.md', 'src/markdown/$refs-blocks.md'],
  conditionalsAlias: {
    bestiary: 'main',
    'bestiary-osr': 'osr',
  },
  tocConfig: {
    rootId: 'toc-main',
  },
  parts: [
    mainModuleConf as IPartProperties,
    {
      ...mainModuleConf,
      id: 'osr',
      documentFileName: 'Зеница Варготара [OSR] ({{version}}).pdf',
      bookmarksConfig: {
        ...mainModuleConf.bookmarksConfig,
        config: 'build/$toc-osr.json',
      },
      skipped: ['0405-appendix-q1--micomant.md'],
    } as IPartProperties,
    mainBestiaryConf as IPartProperties,
    {
      ...mainBestiaryConf,
      id: 'bestiary-osr',
      documentFileName: 'Каталог Аномалий [OSR] ({{version}}).pdf',
      bookmarksConfig: {
        ...mainBestiaryConf.bookmarksConfig,
        config: 'build/$toc-bestiary-osr.json',
      },
    } as IPartProperties,
    {
      id: 'items',
      referenceFiles: ['src/markdown/$refs-items.md'],
      skipBuild: true,
    } as IPartProperties,
    {
      id: 'cover',
      documentTitle: 'Зеница Варготара',
      documentFileName: 'Cover::Beneath the Eye of Vargothar ({{version}}).pdf',
      header: 'Зеница Варготара [cover]',
      skipped: [],
      includePattern: /front-cover-main|back-cover/,
      invalidateBuildOnPattern: /front-cover-main/,
      skipBuild: true,
    } as IPartProperties,
    {
      id: 'test-doc',
      documentTitle: 'Зеница Варготара',
      documentFileName: 'Test doc ({{version}}).pdf',
      header: 'Зеница Варготара [TEST]',
      coverHtmlFile: '0000-front-cover-main.md',
      backCoverHtmlFile: '9999-back-cover.md',
      skipped: [],
      skipBuild: true,
    } as IPartProperties,
    {
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
        headersSelector: 'h1:not([data-skip-toc])',
        rootClassName: 'toc--map',
        renderMaxLevel: 2,
      },
      bookmarksConfig: {
        config: 'build/$toc-map.json',
        skipFirstPages: 1,
      },
      buildPartSize: 5,
      buildProcessesNum: 2,
    } as IPartProperties,
  ],
}

export default config
