/**
 * Script args converted to the module options
 */
export type BuildModuleOptions = {
  partIds: string[]
  isParallel: boolean
  isProduction: boolean
  useHelp: boolean
  useHtmlRebuild: boolean
  usePdfBookmarks: boolean
  configPath?: string
  outputPath?: string
  logLevel?: string
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

//-----------------------------------------------------------------------------
// TOC
//-----------------------------------------------------------------------------

export type ITocOverridesBase = {
  dropLabels?: string[]
  dropItemsFromLabels?: string[]
  alwaysInclude?: string[]
}

export interface ITocOverrides extends ITocOverridesBase {
  /** Per-part overrides, merged with the top-level defaults (part values take priority). */
  parts?: Partial<Record<PartId, ITocOverridesBase>>
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

// FIXME should not be hardcoded
export type PartId = 'main' | 'osr' | 'bestiary' | 'bestiary-osr' | 'items' | 'cover' | 'test-doc' | 'map'

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
}

/**
 * The entire module config, consists of default options (IBaseConfig),
 * which will be merged with each of `.parts: IPartConfig[]`.
 * Part options have precedence over the default root-level options.
 */
export interface IModuleBuilderConfig extends IBaseConfig {
  version: string
  parts: IDocumentConfig[]
  releasePartIds?: string[]
}

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

export interface IDocumentPageMetadata {
  template?: string
  name?: string
  use?: string[]
  'picture-id'?: string
  seqPage?: boolean
  seqPageNum?: number
  documentTitle?: string
  [key: string]: unknown
}

/**
 * A markdown file converted into HTML.
 * A page means 1 file, which is not neccessary represents 1 rendered page
 */
export interface IDocumentPage {
  metadata: IDocumentConfig & IDocumentPageMetadata
  content: string
}
