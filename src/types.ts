/**
 * Script args converted to the module options
 */
export type BuildModuleOptions = {
  documentIds: string[]
  isParallel: boolean
  isProduction: boolean
  useHelp: boolean
  useHtmlRebuild: boolean
  usePdfBookmarks: boolean
  configPath?: string
  outputPath?: string
  logLevel?: string
  serverCommand?: 'start' | 'stop'
  serverPort?: number
}

/**
 * A reference (dictionary) file entry.
 */
export interface IRefEntry {
  fullText: string
  shortText: string
  buffer?: string[]
}

/** A function that transforms a markdown string given a build config. */
export type MacroFn = (markdown: string, config: IDocumentConfig) => string

/** A single find-replace alias: [pattern, replacement]. Pattern may be a literal string or a global RegExp. */
export type AliasEntry = [string | RegExp, string]

//-----------------------------------------------------------------------------
// TOC
//-----------------------------------------------------------------------------

export type ITocOverridesBase = {
  dropLabels?: string[]
  dropItemsFromLabels?: string[]
  alwaysInclude?: string[]
}

export interface ITocOverrides extends ITocOverridesBase {
  /** Per-document overrides, merged with the top-level defaults (document values take priority). */
  documents?: Partial<Record<string, ITocOverridesBase>>
}

export interface ITocConfig {
  headersSelector?: string
  rootClassName?: string
  rootId?: string
  targetId?: string
  renderMaxLevel?: number
  tocOverrides?: ITocOverrides
  /** Anchor ID → 1-based page number. When provided, page numbers are rendered next to each TOC item. */
  pageNumbers?: Record<string, number>
  hiddenToc?: boolean
}

export interface ITocItem {
  label: string
  id?: string
  items?: ITocItem[]
  $skipped?: boolean
  $level?: number
}

export interface IBookmarksConfig {
  config: string
  skipFirstPages?: number
  skipLastPages?: number
}

//-----------------------------------------------------------------------------
// BUILD
//-----------------------------------------------------------------------------

/**
 * Options available per document and per page.
 */
export interface IBaseConfig {
  outputPath: string
  isProduction?: boolean
  template?: string
  footer?: string
  header?: string
  skipped?: string[]
  includePattern?: RegExp
  include?: string[]
  invalidateBuildOnPattern?: RegExp
  tocConfig?: ITocConfig
  bookmarksConfig?: IBookmarksConfig
  referenceFiles?: string[]
  conditionalsAlias?: Record<string, string>
  /**
   * 1-based page numbers to skip header/footer decoration.
   * Negative values count from the end: -1 = last page, -2 = second-to-last, etc.
   * Example: [1, -1] skips the first and last pages.
   */
  skipHeaderAndFooter?: number[]
  /** Same as skipHeaderAndFooter but skips only the header. */
  skipHeader?: number[]
  /** Same as skipHeaderAndFooter but skips only the footer. */
  skipFooter?: number[]
  /** Should skip adding PDF bookmarks? [false] */
  usePdfBookmarks?: boolean
  /** Should rebuild HTML files before rendering to PDF */
  useHtmlRebuild: boolean
  /**
   * Global TOC overrides. Per-document overrides in tocOverrides.documents[id]
   * are merged on top. Replaces the separate conf/oktozin.toc.conf.ts file.
   */
  tocOverrides?: ITocOverrides
  /** Absolute path to the consumer project root. Defaults to process.cwd(). */
  projectRoot?: string
  /** Directory containing Markdown source files. Defaults to <projectRoot>/src/markdown. */
  markdownDir?: string
  /** Directory containing EJS/HTML page templates. Defaults to <projectRoot>/src/html. */
  templatesDir?: string
  /** Directory containing image assets to copy into the build. Defaults to <projectRoot>/src/images. */
  imagesDir?: string
  /**
   * Port for the static file server that serves `build/chunks-html/` during PDF rendering.
   * When set, the builder starts (or reuses) a server on `http://localhost:<port>` before
   * launching Puppeteer. Markdown sources reference images via `{{imagesSrc}}`, which resolves
   * to `http://localhost:<port>/images`.
   */
  webServerPort?: number
  /**
   * When true, the static file server started by `webServerPort` is left running after the build
   * completes. The next build will detect the occupied port and reuse the process automatically.
   */
  keepWebServer?: boolean
  /** Directory containing font assets to copy into the build. Defaults to <projectRoot>/src/styles/fonts. */
  fontsDir?: string
  /** Path to the TTF font used for injected page numbers. Defaults to <fontsDir>/Philosopher/Philosopher-Regular.ttf. */
  pageNumbersFontPath?: string
  /**
   * HTML string injected as a visible watermark on every page in non-production builds.
   * Defaults to empty string (no watermark). Example: '<strong>Draft</strong>'.
   */
  draftWatermarkHtml?: string
  /**
   * Regex character class body for parenthesised chapter reference codes, e.g. `'A-FPQS'`
   * matches `(A4)`, `(S12)`. Set to `null` to disable inline chapter linking entirely.
   * Defaults to `'A-K'`.
   */
  chapterRefPattern?: string | null
  /** Extra find-replace pairs applied after the built-in alias expansion. Supports string or global RegExp patterns. */
  aliases?: AliasEntry[]
  /**
   * Additional macro functions appended after the built-in pipeline.
   * Each macro is a pure `(markdown, config) => markdown` transform.
   */
  macros?: MacroFn[]
  /** Absolute path to the compiled CSS file to copy into the HTML build output. Defaults to `<outputPath>/output.css`. */
  cssPath?: string
}

/**
 * The entire module config, consists of default options (IBaseConfig),
 * which will be merged with each of `.documents: IDocumentConfig[]`.
 * Document options have precedence over the default root-level options.
 */
export interface IModuleBuilderConfig extends IBaseConfig {
  version: string
  documents: IDocumentConfig[]
  releaseDocumentIds?: string[]
}

/**
 * A document is eventually a PDF file.
 */
export interface IDocumentConfig extends IBaseConfig {
  id: string
  documentTitle?: string
  documentFileName?: string
  coverHtmlFile?: string | null
  backCoverHtmlFile?: string | null
  skipBuild?: boolean
  buildPartSize?: number
  buildProcessesNum?: number
}

export enum MetadataUseKeys {
  version = 'version',
  documentTitle = 'documentTitle',
  buildMode = 'buildMode',
}

/**
 * Frontmatter props used in the builder
 */
export interface IDocumentPageMetadata {
  template?: string
  name?: string
  use?: MetadataUseKeys[]
  'picture-id'?: string
  seqPage?: boolean
  seqPageNum?: number
  documentTitle?: string
}

/**
 * A markdown file converted into HTML.
 * A page means 1 file, which is not neccessary represents 1 rendered page
 */
export interface IDocumentPage {
  metadata: IDocumentConfig & IDocumentPageMetadata
  content: string
}
