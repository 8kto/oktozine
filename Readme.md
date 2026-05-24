# Oktozine

npm library that converts Markdown source files into styled PDF documents via Puppeteer. Supports multiple document
variants (e.g. main module, OSR variant, bestiary, maps), parallel PDF rendering, and a custom Markdown macro system.

---

## Installation

```bash
npm install oktozine
# or
yarn add oktozine
```

---

## Quick Start

1. Create a config file `oktozine.build.conf.mjs` (or `.js`) at your project root or in `conf/`:

```js
/** @import { IModuleBuilderConfig, IDocumentConfig } from 'oktozine/types' */

/** @type {IModuleBuilderConfig} */
const config = {
  version: '2',
  releaseDocumentIds: ['main'],
  template: 'two-columns.html',
  header: 'My Document',
  footer: '2025, My Name',
  cssPath: 'build/output.css',
  documents: [
    /** @type {IDocumentConfig} */ ({
      id: 'main',
      documentTitle: 'My Document',
      documentFileName: 'My Document ({{version}}).pdf',
    }),
  ],
}

export default config
```

2. Run the build:

```bash
# Build all documents
oktozine

# Build a specific document
oktozine main

# Force rebuild all HTML files
oktozine --html-no-skip

# Production build (no draft watermark, no -dev suffix)
oktozine --production
```

---

## CLI

```
Usage: oktozine <document IDs> [options]

<document IDs>                      Comma-separated document IDs to build (omit to build all)
-h, --help                          Show help and exit
-x, --html-no-skip, no-html-skip    Rebuild every HTML file, skipping the cache
--parallel                          Build PDFs in parallel (default: serial)
--production                        Production mode: no draft watermark, no -dev version suffix
--skip-bookmarks                    Skip adding PDF bookmarks
--log-level <level>                 Pino log level: trace | debug | info | warn | error | fatal
--config <path>                     Path to a custom build config file
--output-dir <path>                 Base output directory (default: <project-root>/build)
```

Config is auto-discovered in this order:
- `oktozine.build.conf.mjs`
- `oktozine.build.conf.js`
- `conf/oktozine.build.conf.mjs`
- `conf/oktozine.build.conf.js`

**Build phases** (always in this order):

1. `prepareHtmlBuild` — copies static assets (CSS, fonts, images) into `build/chunks-html/`
2. `buildHtml` — processes Markdown → HTML for every document, **serially** (documents can share source files)
3. `buildPdf` — renders HTML → PDF for every document, serially by default or in parallel with `--parallel`

Each document config is deep-merged over the top-level defaults before being passed to the builders.

---

## Build Config — `oktozine.build.conf.mjs`

Exports a default `IModuleBuilderConfig` object that describes every document. The config file must be ESM (use
`.mjs`, or `.js` with `"type": "module"` in your `package.json`).

### Top-level fields (`IModuleBuilderConfig` / `IBaseConfig`)

Fields marked **M** belong to `IModuleBuilderConfig` only; all others belong to `IBaseConfig` and can be overridden
per-document.

| Field                      | Type                     | M   | Description                                                                                                                                        |
| -------------------------- | ------------------------ | --- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`                  | `string`                 | ✓   | Config format version. Must satisfy `[major.minor, major+1.x)` of the installed oktozine package.                                                  |
| `documents`                | `IDocumentConfig[]`      | ✓   | List of documents to build                                                                                                                         |
| `releaseDocumentIds`       | `string[]`               | ✓   | Document IDs included in a production release                                                                                                      |
| `outputPath`               | `string`                 |     | Root directory for all build output. Defaults to `<cwd>/build`.                                                                                    |
| `isProduction`             | `boolean`                |     | Strips the `-dev` version suffix and disables the draft watermark. Set via `--production` or `BUILD_MODE=production`.                              |
| `useHtmlRebuild`           | `boolean`                |     | Force rebuild all HTML files regardless of the timestamp cache. Set via `--html-no-skip`.                                                          |
| `usePdfBookmarks`          | `boolean`                |     | Add PDF named-destination bookmarks to the output. [false]                                                                                         |
| `template`                 | `string`                 |     | Default HTML template filename (relative to `templatesDir`)                                                                                        |
| `header`                   | `string`                 |     | Default running header text injected into `{{header}}` in every template                                                                           |
| `footer`                   | `string`                 |     | Default running footer text injected into `{{footer}}` in every template                                                                           |
| `skipped`                  | `string[]`               |     | Markdown filenames excluded from the build (global blocklist)                                                                                      |
| `include`                  | `string[]`               |     | Explicit allowlist of Markdown filenames. When set, `skipped` and `includePattern` are ignored.                                                    |
| `includePattern`           | `RegExp`                 |     | Regex allowlist; only matching filenames are built. Ignored when `include` is set.                                                                 |
| `invalidateBuildOnPattern` | `RegExp`                 |     | If any source file matching this pattern has changed, all HTML files for that document are rebuilt                                                 |
| `referenceFiles`           | `string[]`               |     | Paths to `$refs-*.md` files loaded into the reference dictionary                                                                                   |
| `conditionalsAlias`        | `Record<string, string>` |     | Maps a document ID to another for `{{  }}` conditional fallback (e.g. `bestiary-osr → bestiary`)                                                   |
| `tocConfig`                | `ITocConfig`             |     | TOC settings (see **TOC Config** section)                                                                                                          |
| `tocOverrides`             | `ITocOverrides`          |     | Global TOC overrides applied before per-document overrides.                                                                                        |
| `skipHeaderAndFooter`      | `number[]`               |     | 1-based page numbers that skip both header and footer. Negative values count from the end (`-1` = last page).                                      |
| `skipHeader`               | `number[]`               |     | Same, but header only                                                                                                                              |
| `skipFooter`               | `number[]`               |     | Same, but footer only                                                                                                                              |
| `bookmarksConfig`          | `IBookmarksConfig`       |     | PDF bookmark config: `{ config: string; skipFirstPages?: number; skipLastPages?: number }`                                                         |
| `projectRoot`              | `string`                 |     | Absolute path to the consuming app root. Defaults to `process.cwd()`.                                                                             |
| `markdownDir`              | `string`                 |     | Directory containing Markdown sources. Defaults to `<projectRoot>/src/markdown`.                                                                   |
| `templatesDir`             | `string`                 |     | Directory containing EJS/HTML page templates. Defaults to `<projectRoot>/src/html`.                                                                |
| `imagesDir`                | `string`                 |     | Directory containing image assets. Defaults to `<projectRoot>/src/images`.                                                                         |
| `fontsDir`                 | `string`                 |     | Directory containing font assets. Defaults to `<projectRoot>/src/styles/fonts`.                                                                    |
| `pageNumbersFontPath`      | `string`                 |     | TTF font used for injected page numbers. Defaults to `<fontsDir>/Philosopher/Philosopher-Regular.ttf`.                                             |
| `cssPath`                  | `string`                 |     | Absolute path to the compiled CSS file copied into the HTML build output. Defaults to `<outputPath>/output.css`.                                   |
| `draftWatermarkHtml`       | `string`                 |     | HTML string injected as a watermark on every page in non-production builds. Example: `'<strong>Draft</strong>'`. Default: `''`.                    |
| `chapterRefPattern`        | `string \| null`         |     | Regex character class body for inline room-reference linking. E.g. `'A-FPQS'` matches `(A4)`, `(S12)`. Default: `'A-K'`. Set to `null` to disable. |
| `aliases`                  | `AliasEntry[]`           |     | Extra `[pattern, replacement]` pairs appended to the alias macro. Pattern may be a string or a global `RegExp`.                                    |
| `macros`                   | `MacroFn[]`              |     | Additional `(markdown, config) => markdown` transforms appended after the built-in macro pipeline.                                                 |

### Per-document fields (`IDocumentConfig`)

All `IBaseConfig` fields apply and can be overridden per-document. Document-specific additions:

| Field               | Type             | Description                                                                     |
| ------------------- | ---------------- | ------------------------------------------------------------------------------- |
| `id`                | `string`         | **Required.** Unique document identifier used in file paths and conditionals.   |
| `documentTitle`     | `string`         | Title embedded in the PDF                                                       |
| `documentFileName`  | `string`         | Output filename template; `{{version}}` is replaced with `package.json` version |
| `coverHtmlFile`     | `string \| null` | Source filename for the front cover (no page delimiter appended)                |
| `backCoverHtmlFile` | `string \| null` | Source filename for the back cover                                              |
| `skipBuild`         | `boolean`        | Exclude this document from default (no-args) builds                             |
| `buildPartSize`     | `number`         | Pages per PDF chunk (overrides auto-calculation)                                |
| `buildProcessesNum` | `number`         | Number of parallel Chromium instances for this document                         |

### PDF chunk tuning — measured build times (main module)

`buildPartSize` and `buildProcessesNum` trade off full-rebuild speed against incremental-rebuild speed. Fewer pages per
chunk means fewer pages re-rendered when a single file changes, at the cost of more parallel processes.

| `buildPartSize × buildProcessesNum` | Full rebuild | 1 file changed | 2 files changed |
| ----------------------------------- | ------------ | -------------- | --------------- |
| 4 × 15                              | 10.8–11 s    | 6–7.2 s        | 6.1–7.2 s       |
| 2 × 30                              | 13.9–14.1 s  | 7.2 s          | 6.5–7.3 s       |
| 3 × 20                              | 11.6–12.6 s  | 7.2 s          | 7.3 s           |
| 5 × 12                              | 10.8 s       | 8–8.2 s        | 8.2 s           |

Measurements taken with `PDF_PARALLEL` ≥ `buildProcessesNum` (no queuing). Incremental times assume the chunk cache is
warm (second build after a change).

### Example

```js
/** @import { IDocumentConfig, IModuleBuilderConfig } from 'oktozine/types' */

/** @type {Partial<IDocumentConfig>} */
const mainModuleConf = {
  id: 'main',
  documentTitle: 'My Document',
  documentFileName: 'My Document ({{version}}).pdf',
  coverHtmlFile: '0000-front-cover.md',
  backCoverHtmlFile: '9999-back-cover.md',
  skipped: ['0405-appendix-osr.md'],
  tocConfig: {
    headersSelector: 'h1:not([data-skip-toc]), h2:not([data-skip-toc]), h3, h4, h5',
    rootClassName: 'toc--main',
    renderMaxLevel: 2,
  },
  buildPartSize: 8,
  buildProcessesNum: 8,
  skipHeaderAndFooter: [-1, 1, 2, 3], // last page + first 3 pages
  skipFooter: [17, 23],
}

/** @type {IModuleBuilderConfig} */
const config = {
  version: '2',
  releaseDocumentIds: ['main'],
  template: 'two-columns.html',
  header: 'My Document',
  footer: '2025, My Name',
  cssPath: 'build/output.css',
  documents: [/** @type {IDocumentConfig} */ (mainModuleConf)],
}

export default config
```

---

## TOC Config — `ITocConfig` and `ITocOverrides`

The table of contents is built inside a Puppeteer browser context by `buildToc` in `lib/table-of-contents.ts`, which is
serialized and evaluated as a browser function.

### `ITocConfig`

| Field             | Type            | Default        | Description                                                        |
| ----------------- | --------------- | -------------- | ------------------------------------------------------------------ |
| `headersSelector` | `string`        | `'h1, h2, h3'` | CSS selector for headings to include in the TOC                    |
| `rootId`          | `string`        | `'toc-main'`   | `id` of the DOM element where the TOC nav is injected              |
| `rootClassName`   | `string`        | —              | Extra CSS class added to the `<nav>` element                       |
| `targetId`        | `string`        | `'toc-main'`   | Alias for `rootId` used inside `renderToc`                         |
| `renderMaxLevel`  | `number`        | —              | Heading depth cap; headings deeper than this are hidden in the TOC |
| `tocOverrides`    | `ITocOverrides` | —              | Fine-grained control over which entries appear (see below)         |

### `ITocOverrides`

| Field                 | Type                                             | Description                                                         |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| `dropLabels`          | `string[]`                                       | Heading texts to remove entirely (heading + all its children)       |
| `dropItemsFromLabels` | `string[]`                                       | Headings whose _children_ are removed, but the heading itself stays |
| `alwaysInclude`       | `string[]`                                       | Headings that are shown even if `renderMaxLevel` would hide them    |
| `documents`           | `Partial<Record<DocumentId, ITocOverridesBase>>` | Per-document overrides merged on top of the top-level overrides     |

### TOC build pipeline

1. `getTocData` — queries the DOM for headings matching `headersSelector`, assigns `id` slugs to headings that lack one,
   and builds a nested `ITocItem[]` tree.
2. `overrideToc` — applies `dropLabels` / `dropItemsFromLabels` by marking items `$skipped`.
3. `applyRenderMaxLevel` — marks items deeper than `renderMaxLevel` as `$skipped`.
4. `renderToc` — inserts a `<nav class="toc-nav">` element into `#rootId`, respecting `alwaysInclude` even for skipped
   items.
5. `stripInternals` — removes `$level` / `$skipped` internal fields from the returned data and filters out skipped items
   before writing `build/$toc-<id>.json`.

---

## Markdown Macro System

Macros are processed by `macros/index.ts` in a fixed pipeline before Markdown rendering. Each macro is a pure
`(markdown, config) => markdown` function.

### Pipeline order

| #   | Handler                | What it does                                                          |
| --- | ---------------------- | --------------------------------------------------------------------- |
| 1   | `convertDumpInserts`   | `<!-- cmd[dump] ref-file[…] /-->` → all entries from a reference file |
| 2   | `parseConditionalMode` | Inline conditionals                                                   |
| 3   | `addAliases`           | HTML comment macros and item/stats shortcuts                          |
| 4   | `convertNamedSections` | `<!-- named[id] /-->` → hidden anchor elements                        |
| 5–9 | `glue*`                | Non-breaking space insertion between words, units, shorthands         |
| 10  | `convertListToTable`   | Converts special Markdown lists to HTML tables                        |
| 11  | `convertRefInserts`    | Inlines referenced content blocks from `$refs-*.md`                   |
| 12  | `convertStatsInserts`  | Inlines stat blocks                                                   |
| 13  | `linkify`              | Auto-links room references `(A4)` and room headings                   |
| 14… | `config.macros`        | Additional custom macros supplied via `IBaseConfig.macros`            |

Macros also run on the content of each reference block before it is inserted (step 11 calls `handleMacros` recursively
on resolved content). The `convertRefInserts` handler itself is excluded from that recursive pass to prevent infinite
loops.

---

### `parseConditionalMode` — inline conditionals

Replaces `` `{{ branchId: content | branchId: content }}` `` with the branch matching the current document's `id`. If no
branch matches directly, falls back to `conditionalsAlias`.

```markdown
`{{ main: This text appears in the main build | osr: OSR-specific text }}`
```

Output is wrapped in `<span class="conditional-block conditional-block--<id>">`.

---

### `addAliases` — HTML comment macros

Shorthand macros written as HTML comments, processed before Markdown rendering:

| Syntax                           | Expands to                                                |
| -------------------------------- | --------------------------------------------------------- |
| `<!-- item[Name] … /-->`         | `<!-- cmd[ref] header[Name] detailed … /-->`              |
| `<!-- stats[Name] … /-->`        | `<!-- cmd[ref] header[Name] detailed … /-->`              |
| `<!-- cmd:if[mode] -->`          | `<div class="conditional-block conditional-block--mode">` |
| `<!-- cmd:if[mode] margin -->`   | Same, with extra `conditional-block--with-margin` class   |
| `<!-- /cmd:if -->`               | `</div>`                                                  |
| `<!-- col-break /-->`            | Column break element                                      |
| `<!-- col-stop /-->`             | Column stop element                                       |
| `<!-- page-break /-->`           | Page break element                                        |
| `<!-- span-all-columns /-->`     | Span-all-columns spacer                                   |
| `<!-- pic[type] id[elemId] /-->` | `<div id="elemId" class="pic-type"></div>`                |

For OSR builds (`id` ending in `osr`), `:` is replaced with `: ` (non-breaking colon spacing).

---

### `convertNamedSections` — hidden anchors

Creates invisible navigation targets (jump-to anchors) in the output.

```markdown
<!-- named[secret-room] /-->
```

Output:

```html
<a id="secret-room" class="hidden"></a>
```

| Argument    | Description                                      |
| ----------- | ------------------------------------------------ |
| `named[id]` | The anchor `id` value, used verbatim in the HTML |

---

### `glue*` — typography / non-breaking spaces

Six micro-macros that prevent unwanted line breaks around numbers, units, abbreviations, and compound terms. They run as
separate pipeline steps so they can be reordered or disabled individually.

| Function                    | Pattern                 | Result                       |
| --------------------------- | ----------------------- | ---------------------------- |
| `glueWords`                 | `2:6`                   | `<nobr>2:6</nobr>`           |
| `glueUnits`                 | `10 м`, `5 фунтов`      | `10&nbsp;м`, `5&nbsp;фунтов` |
| `glueShorthands`            | `и т. д.`, `т. е.`      | `<nobr>и т. д.</nobr>`       |
| `glueUnitsWithNoLineBreaks` | `10′`, `5″`             | `<nobr>10′</nobr>`           |
| `glueDamageUnits`           | `2d6 урона`, `3 раунда` | `2d6&nbsp;урона`             |

**Supported units** (`glueUnits`): мм, см, зм, фунтов.

**Supported abbreviations** (`glueShorthands`): и т. д., и т.д., и т. п., и т.п., в т. ч., в т.ч., и др., и пр., т. д.,
т.д., т. п., т.п., т. е., т.е., т. к., т.к., т. н., т.н.

**Damage/duration units** (`glueDamageUnits`): урон*, ход*, раунд*, раз*. Handles both dice notation (`2d6 урона`) and
plain numbers (`3 раунда`).

---

### `convertListToTable` — list-to-table conversion

Converts fenced Markdown lists into Markdown tables. The block is delimited by an opening
`<!-- cmd[list-to-table] … -->` comment and a closing `<!-- /cmd -->`.

```markdown
<!-- cmd[list-to-table] header[d4|Encounter] no-page-break id[random-enc] -->

- 1 | A swarm of bats
- 2 | Dripping ceiling
- 3 | Loose rubble
- 4 | Mushroom patch
<!-- /cmd -->
```

| Argument         | Required | Description                                          |
| ---------------- | -------- | ---------------------------------------------------- |
| `header[c1\|c2]` | yes      | Pipe-separated column headers                        |
| `no-page-break`  | no       | Adds a CSS class to prevent the table from splitting |
| `id[value]`      | no       | Sets `id="value"` on the wrapper `<div>`             |

Each list item is a `- left | right` row. Items that don't match the pattern are silently dropped.

---

### `convertRefInserts` — reference insertion

Pulls named content blocks from the reference dictionary (built from `referenceFiles`) and inlines them.

```markdown
<!-- cmd[ref] header[Block Name] /-->
<!-- cmd[ref] header[Block Name] detailed /-->
<!-- cmd[ref] header[Block Name] detailed no-page-break alt no-header id[myAnchor] /-->
```

| Modifier        | Effect                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| `detailed`      | Uses the full block text instead of the short (first-sentence) version |
| `no-page-break` | Wraps the block to suppress a page break before it                     |
| `alt`           | Applies an alternate visual style                                      |
| `no-header`     | Omits the block's heading                                              |
| `alt-header`    | Uses the alternate heading style                                       |
| `id[value]`     | Sets `id="value"` on the wrapper element                               |

Reference files are standard Markdown files where each `##` heading defines a named block. Everything between two `##`
headings is that block's content.

---

### `convertStatsInserts` — inline stat blocks

Expands compact stat-block shorthand (single-brace `` `{ … }` ``) into styled HTML. Stat keys are English abbreviations
that are translated to Russian in the output.

```markdown
`{ AC: 14; HD: 2; HP: 9; Atk: 1; DMG: 1d6; MV: 40; ML: 8; A: N; XP: 20; S: F2; CL: 2 }`
```

**Supported stat keys:**

| Key   | Russian              | Meaning                    |
| ----- | -------------------- | -------------------------- |
| `AC`  | КБ                   | Armour Class               |
| `HD`  | ХД                   | Hit Dice                   |
| `HP`  | ХП                   | Hit Points                 |
| `Atk` | Атаки                | Attacks (multiattack link) |
| `DMG` | Урон                 | Damage                     |
| `MV`  | Скорость             | Movement Speed             |
| `ML`  | Мораль               | Morale                     |
| `A`   | МВ (Мировоззрение)   | Alignment                  |
| `XP`  | Опыт                 | Experience Points          |
| `S`   | Спасброски           | Saving Throws              |
| `CL`  | Сложность            | Challenge Level            |
| `LVL` | Уровень              | Level                      |
| `MR`  | Устойчивость к магии | Magic Resistance           |

**Special value handling:**

- **Alignment (`A`):** `C` → Хаос, `L` → Законное, `N` → Нейтральное.
- **Dash (`-`):** rendered as "Нет".
- **`Atk`:** rendered as a clickable link to the multiattack rules anchor (`#anchor-multiattack`).

The output is wrapped in `<div class="stats-insert no-page-break">`.

> **Note:** Single braces `` `{ … }` `` are stat blocks; double braces `` `{{ … }}` `` are conditionals
> (`parseConditionalMode`). The regex uses a negative lookahead to distinguish them.

---

### `linkify` — room reference linking

Auto-links room references and room headings. Two passes run sequentially:

1. **Inline refs** (`linkChapters`): `(A4)` → `<a class="linkified" target="_self" href="#room-a4">(A4)</a>`. Matched
   prefixes come from `config.chapterRefPattern` (a regex character class body). Default: `'A-K'`. Set to `null` to skip
   this pass entirely.
2. **Headings** (`linkHeaders`): `## A2. Throne Room` → `<h2 id="room-a2">A2. Throne Room</h2>`. Matched prefixes are
   hardcoded to `[A-FPQS]` and are not affected by `chapterRefPattern`.

```markdown
The passage leads to (A4). → …<a class="linkified" target="_self" href="#room-a4">(A4)</a>.

## S1. Engine Bay → <h2 id="room-s1">S1. Engine Bay</h2>
```

---

## Frontmatter Reference

Each Markdown file may include a YAML frontmatter block. The following keys are recognised by the oktozine builder
(`IDocumentPageMetadata`).

| Key             | Type       | Required | Description                                                                                                |
| --------------- | ---------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `template`      | `string`   | **yes**  | Filename (relative to `templatesDir`) of the EJS/HTML page template to render this file into.              |
| `name`          | `string`   | no       | Sets the `id` and `data-id` attributes on the section wrapper element (`data-id-placeholder` in template). |
| `use`           | `string[]` | no       | List of template placeholder keys to activate. See **`use` values** below.                                 |
| `picture-id`    | `string`   | no       | Replaces the `{{pictureId}}` placeholder in the template.                                                  |
| `seqPage`       | `boolean`  | no       | When `true`, this file generates multiple sequential HTML output files.                                    |
| `seqPageNum`    | `number`   | no       | 1-based index for the current sequential page. Set automatically by the pipeline; do not set manually.     |
| `documentTitle` | `string`   | no       | Overrides the document title for this individual page.                                                     |

### `use` values

The `use` array activates optional template placeholder substitutions:

| Value             | Template placeholder | Replaced with                                                                    |
| ----------------- | -------------------- | -------------------------------------------------------------------------------- |
| `"version"`       | `{{version}}`        | Consuming app's `package.json` version; appends `-dev` in non-production builds. |
| `"documentTitle"` | `{{documentTitle}}`  | The `documentTitle` frontmatter key, or the document config's `documentTitle`.   |
| `"buildMode"`     | `{{buildMode}}`      | Empty string in production; the `draftWatermarkHtml` config value otherwise.     |

### Example

```yaml
---
template: chapter.html
name: chapter-intro
documentTitle: Introduction
use:
  - version
  - buildMode
---
```

---

## Environment Variables

| Variable          | Description                                                                           |
| ----------------- | ------------------------------------------------------------------------------------- |
| `HTML_NO_SKIP`    | Set to any truthy value to bypass the HTML timestamp cache (same as `--html-no-skip`) |
| `PINO_LOG_LEVEL`  | Pino log level (overridden by `--log-level`)                                          |
| `PDF_PARALLEL`    | Max parallel Chromium instances per PDF render phase (default: `4`)                   |
| `BUILD_MODE`      | Set to `production` to strip the draft watermark and `-dev` version suffix            |
| `BUILD_DUMP_HTML` | Set to `false` to skip writing the `$fullHtmlContent-*.html` debug dump               |

---

## Output Layout

```
build/
  output.css                        Compiled Tailwind CSS
  chunks-html/
    module-<id>/                    Per-document HTML chunks (one file per Markdown source)
    $toc-<id>.html                  Rendered TOC HTML (extracted from DOM after buildToc)
    $fullHtmlContent-<id>.html      Full merged HTML (debug dump, written unless BUILD_DUMP_HTML=false)
  $toc-<id>.json                    TOC tree as JSON (used by bookmark builder)
  pdf/
    <documentFileName>.pdf          Final merged PDF
```

---

## Adding a new Document

1. Add a `Partial<IDocumentConfig>` object in `oktozine.build.conf.mjs`.
2. Include it in the `documents` array.
3. If needed, add per-document TOC overrides via `tocOverrides.documents.<id>` in the top-level config.
4. Add it to `releaseDocumentIds` if it should be included in production releases.
5. Run `oktozine <id> --html-no-skip` to verify.

---

## Programmatic API

```js
import { buildHtml } from 'oktozine/build-html'
import { buildPdf } from 'oktozine/build-pdf'
```

Both functions accept a fully-merged `IDocumentConfig` (top-level defaults deep-merged with the document config).
