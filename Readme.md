# Oktozine Build System

TypeScript build pipeline that converts Markdown source files into styled PDF documents via Puppeteer. Supports multiple document "parts" (e.g. main module, OSR variant, bestiary, maps), parallel PDF rendering, and a custom Markdown macro system.

---

## Quick Start

```bash
# Build the main part only
yarn build

# Build all parts (main, osr, map) + bestiaries
yarn build:all

# Build a specific part
tsx scripts/oktozine/build-module.ts <partId> [options]
```

---

## CLI — `build-module.ts`

The entry point for all builds.

```
Usage: tsx scripts/oktozine/build-module.ts <partIds> [options]

<partIds>        Comma-separated part IDs to build (omit to build all non-skipped parts)
-h, --help       Show help and exit
-x, --html-no-skip
                 Rebuild every HTML file, ignoring the timestamp cache
--parallel       Render PDFs for all parts in parallel (default: serial)
--log-level      Pino log level: trace | debug | info | warn | error | fatal
--config <path>  Path to a custom build config file (default: conf/oktozin.build.conf.ts)
```

**Build phases** (always in this order):

1. `prepareHtmlBuild` — copies static assets (CSS, fonts, images) into `build/chunks-html/`
2. `buildHtml` — processes Markdown → HTML for every part, **serially** (parts can share source files)
3. `buildPdf` — renders HTML → PDF for every part, serially by default or in parallel with `--parallel`

Each part config is deep-merged over the top-level defaults before being passed to the builders.

---

## Build Config — `conf/oktozin.build.conf.ts`

Exports a default `IModuleBuilderConfig` object that describes every document part.

### Top-level fields (defaults shared by all parts)

| Field | Type | Description |
|---|---|---|
| `parts` | `IPartProperties[]` | List of document parts to build |
| `releasePartIds` | `string[]` | Part IDs included in a production release |
| `template` | `string` | Default HTML template filename (relative to `src/html/`) |
| `header` | `string` | Default running header text |
| `footer` | `string` | Default running footer text |
| `skipped` | `string[]` | Markdown filenames excluded from all parts (global blocklist) |
| `referenceFiles` | `string[]` | Paths to `$refs-*.md` files loaded into the reference dictionary |
| `conditionalsAlias` | `Record<string, string>` | Maps a part ID to another for `{{ }}` conditional fallback (e.g. `bestiary-osr → bestiary`) |
| `tocConfig` | `ITocConfig` | Default TOC settings (merged per-part) |
| `skipHeaderAndFooter` | `number[]` | 1-based page numbers that skip both header and footer decoration. Negative values count from the end (`-1` = last page) |
| `skipHeader` | `number[]` | Same, but header only |
| `skipFooter` | `number[]` | Same, but footer only |
| `invalidateBuildOnPattern` | `RegExp` | If any source file matching this pattern has changed, all HTML files for the part are rebuilt |

### Per-part fields (`IPartProperties`)

All top-level defaults apply. Parts can override any field. Part-specific additions:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique part identifier used in file paths and conditionals |
| `documentTitle` | `string` | Title embedded in the PDF |
| `documentFileName` | `string` | Output filename template, `{{version}}` is replaced with `package.json` version |
| `coverHtmlFile` | `string \| null` | Source filename for the front cover (no page delimiter appended) |
| `backCoverHtmlFile` | `string \| null` | Source filename for the back cover |
| `skipBuild` | `boolean` | Exclude this part from default (no-args) builds |
| `include` | `string[]` | Allowlist of Markdown filenames; overrides `skipped` and `includePattern` |
| `includePattern` | `RegExp` | Regex allowlist; only matching filenames are built |
| `buildPartSize` | `number` | Pages per PDF chunk (overrides auto-calculation) |
| `buildProcessesNum` | `number` | Number of parallel Chromium instances for this part |

### Example

```typescript
const mainModuleConf: Partial<IPartProperties> = {
  id: 'main',
  documentTitle: 'Зеница Варготара',
  documentFileName: 'Зеница Варготара ({{version}}).pdf',
  coverHtmlFile: '0000-front-cover-main.md',
  backCoverHtmlFile: '9999-back-cover.md',
  skipped: ['0405-appendix-q1--micomant--osr.md'],
  tocConfig: {
    headersSelector: 'h1:not([data-skip-toc]), h2:not([data-skip-toc]), h3, h4, h5',
    rootClassName: 'toc--main',
    renderMaxLevel: 2,
  },
  buildPartSize: 8,
  buildProcessesNum: 8,
  skipHeaderAndFooter: [-1, 1, 2, 3],   // last page + first 3 pages
  skipFooter: [17, 23],
}
```

---

## TOC Config — `ITocConfig` and `ITocOverrides`

The table of contents is built inside a Puppeteer browser context by `buildToc` in `lib/table-of-contents.ts`, which is serialized and evaluated as a browser function.

### `ITocConfig`

| Field | Type | Default | Description |
|---|---|---|---|
| `headersSelector` | `string` | `'h1, h2, h3'` | CSS selector for headings to include in the TOC |
| `rootId` | `string` | `'toc-main'` | `id` of the DOM element where the TOC nav is injected |
| `rootClassName` | `string` | — | Extra CSS class added to the `<nav>` element |
| `targetId` | `string` | `'toc-main'` | Alias for `rootId` used inside `renderToc` |
| `renderMaxLevel` | `number` | — | Heading depth cap; headings deeper than this are hidden in the TOC |
| `tocOverrides` | `ITocOverrides` | — | Fine-grained control over which entries appear (see below) |

### `ITocOverrides`

| Field | Type | Description |
|---|---|---|
| `dropLabels` | `string[]` | Heading texts to remove entirely (heading + all its children) |
| `dropItemsFromLabels` | `string[]` | Headings whose *children* are removed, but the heading itself stays |
| `alwaysInclude` | `string[]` | Headings that are shown even if `renderMaxLevel` would hide them |
| `parts` | `Partial<Record<PartId, ITocOverridesBase>>` | Per-part overrides merged on top of the top-level overrides |

Overrides are defined in `conf/oktozin.toc.conf.ts` and passed into `buildToc` at PDF build time.

### TOC build pipeline

1. `getTocData` — queries the DOM for headings matching `headersSelector`, assigns `id` slugs to headings that lack one, and builds a nested `ITocItem[]` tree.
2. `overrideToc` — applies `dropLabels` / `dropItemsFromLabels` by marking items `$skipped`.
3. `applyRenderMaxLevel` — marks items deeper than `renderMaxLevel` as `$skipped`.
4. `renderToc` — inserts a `<nav class="toc-nav">` element into `#rootId`, respecting `alwaysInclude` even for skipped items.
5. `stripInternals` — removes `$level` / `$skipped` internal fields from the returned data and filters out skipped items before writing `build/$toc-<id>.json`.

---

## Markdown Macro System

Macros are processed by `commands/index.ts` in a fixed pipeline before Markdown rendering. Each macro is a pure `(markdown, config) => markdown` function.

### Pipeline order

| # | Handler | What it does |
|---|---|---|
| 1 | `parseConditionalMode` | Inline conditionals |
| 2 | `addAliases` | HTML comment macros and item/stats shortcuts |
| 3 | `convertNamedSections` | `<!-- anchor[id] -->` → anchor elements |
| 4–9 | `glue*` | Non-breaking space insertion between words, units, shorthands |
| 10 | `convertListToTable` | Converts special Markdown lists to HTML tables |
| 11 | `convertRefInserts` | Inlines referenced content blocks from `$refs-*.md` |
| 12 | `convertStatsInserts` | Inlines stat blocks |
| 13 | `linkify` | Auto-links bare URLs |

Macros also run on the content of each reference block before it is inserted (step 11 calls `handleCommands` recursively on resolved content). The `convertRefInserts` handler itself is excluded from that recursive pass to prevent infinite loops.

---

### `parseConditionalMode` — inline conditionals

Replaces `` `{{ branchId: content | branchId: content }}` `` with the branch matching the current part's `id`. If no branch matches directly, falls back to `conditionalsAlias`.

```markdown
`{{ main: This text appears in the main build | osr: OSR-specific text }}`
```

Output is wrapped in `<span class="conditional-block conditional-block--<id>">`.

---

### `addAliases` — HTML comment macros

Shorthand macros written as HTML comments, processed before Markdown rendering:

| Syntax | Expands to |
|---|---|
| `<!-- item[Name] … /-->` | `<!-- cmd[ref] header[Name] detailed … /-->` |
| `<!-- stats[Name] … /-->` | `<!-- cmd[ref] header[Name] detailed … /-->` |
| `<!-- cmd:if[mode] -->` | `<div class="conditional-block conditional-block--mode">` |
| `<!-- cmd:if[mode] margin -->` | Same, with extra `conditional-block--with-margin` class |
| `<!-- /cmd:if -->` | `</div>` |
| `<!-- col-break /-->` | Column break element |
| `<!-- col-stop /-->` | Column stop element |
| `<!-- page-break /-->` | Page break element |
| `<!-- span-all-columns /-->` | Span-all-columns spacer |
| `<!-- pic[type] id[elemId] /-->` | `<div id="elemId" class="pic-type"></div>` |

For OSR builds (`id` ending in `osr`), ` : ` is replaced with `: ` (non-breaking colon spacing).

---

### `convertRefInserts` — reference insertion

Pulls named content blocks from the reference dictionary (built from `referenceFiles`) and inlines them.

```markdown
<!-- cmd[ref] header[Block Name] /-->
<!-- cmd[ref] header[Block Name] detailed /-->
<!-- cmd[ref] header[Block Name] detailed no-page-break alt no-header id[myAnchor] /-->
```

| Modifier | Effect |
|---|---|
| `detailed` | Uses the full block text instead of the short (first-sentence) version |
| `no-page-break` | Wraps the block to suppress a page break before it |
| `alt` | Applies an alternate visual style |
| `no-header` | Omits the block's heading |
| `alt-header` | Uses the alternate heading style |
| `id[value]` | Sets `id="value"` on the wrapper element |

Reference files are standard Markdown files where each `##` heading defines a named block. Everything between two `##` headings is that block's content.

---

## Environment Variables

| Variable | Description |
|---|---|
| `HTML_NO_SKIP` | Set to any truthy value to bypass the HTML timestamp cache (same as `--html-no-skip`) |
| `LOG_LEVEL` | Pino log level (overridden by `--log-level`) |
| `PDF_PARALLEL` | Max parallel Chromium instances per PDF render phase (default: `4`) |
| `BUILD_MODE` | Set to `production` to strip the draft watermark and `-dev` version suffix |
| `BUILD_DUMP_HTML` | Set to `false` to skip writing the `$fullHtmlContent-*.html` debug dump |

---

## Output Layout

```
build/
  output.css                        Compiled Tailwind CSS
  chunks-html/
    module-<id>/                    Per-part HTML chunks (one file per Markdown source)
    $toc-<id>.html                  Rendered TOC HTML (extracted from DOM after buildToc)
    $fullHtmlContent-<id>.html      Full merged HTML (debug dump, written unless BUILD_DUMP_HTML=false)
  $toc-<id>.json                    TOC tree as JSON (used by bookmark builder)
  pdf/
    <documentFileName>.pdf          Final merged PDF
```

---

## Adding a New Part

1. Add a `Partial<IPartProperties>` object in `conf/oktozin.build.conf.ts`.
2. Include it in the `parts` array.
3. If needed, add per-part TOC overrides in `conf/oktozin.toc.conf.ts` under `tocOverrides.parts.<id>`.
4. Add it to `releasePartIds` if it should be included in production releases.
5. Run `tsx scripts/oktozine/build-module.ts <id> --html-no-skip` to verify.
