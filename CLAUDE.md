# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context

`scripts/oktozine/` is a standalone build pipeline for PDF documents. It converts Markdown → HTML → PDF. **It is being
extracted as a separate npm library** — keep code generic and avoid module-specific hard-coding.

## Commands

```bash
# Full build (CSS + HTML + PDF for 'main' document)
yarn build

# Build specific document
yarn build:styles && tsx scripts/oktozine/build-module.ts <documentId> [options]

# Build options
--html-no-skip     # Force rebuild all HTML files (bypass cache)
--parallel         # Build PDFs for multiple documents in parallel
--log-level debug  # Set log verbosity (trace|debug|info|warn|error)
--config <path>    # Override build config file path

# Run all tests
yarn test

# Run a single test file
NODE_OPTIONS=--experimental-vm-modules npx jest scripts/oktozine/path/to/file.test.ts

# Lint
yarn lint

# Format check / fix
yarn format
yarn format:fix
```

## Environment Variables

| Variable                | Effect                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `PDF_PARALLEL`          | Number of parallel Puppeteer instances (default: 4)                                              |
| `BUILD_DUMP_HTML`       | Dump assembled HTML to `build/chunks-html/$fullHtmlContent-{id}.html` (any value except `false`) |
| `BUILD_TOC_PAGENUMS`    | Enable TOC page-number patching (Phase 4 of PDF build); experimental and slow                    |
| `BUILD_MODE=production` | Enables production markers in templates                                                          |
| `PINO_LOG_LEVEL`        | Pino log level                                                                                   |

## Architecture

### Pipeline Overview

```
build-module.ts  (CLI orchestrator)
  → build-html.ts       per document, serial
  → build-pdf.ts        per document, serial by default
```

### HTML Build (`build-html.ts`)

Reads Markdown from `src/markdown/`, runs the macro pipeline, applies an EJS HTML template, writes to
`build/chunks-html/module-{id}/`.

**Incremental caching:** tracks a last-build timestamp in `/tmp/HTML_BUILDER_LAST_BUILD$-{id}.txt`. Files whose `mtime`
is older than the timestamp are skipped. Pass `--html-no-skip` (sets `HTML_NO_SKIP=true`) to force a full rebuild.

**Invalidation:** if `invalidateBuildOnPattern` matches any changed file, all files for that document are rebuilt.

**File filtering** per document config: `include` (explicit list), `includePattern` (regex), `skipped` (exclusion list).
These are mutually exclusive; they combine as `include > includePattern > skipped`.

### Macro Pipeline (`macros/`)

`macros/index.ts` applies transforms sequentially: `(markdown, config) => markdown`. Each macro is a pure function.
Errors in individual macros are caught and logged without aborting the pipeline.

Pipeline order matters — macros run in the order registered in `index.ts`:

1. `conditionals` — `{{main: ... | osr: ...}}` blocks
2. `alias` — shorthand expansion
3. `named` — `:::name` → `<section>` with id
4. `glue-*` — non-breaking spaces (Russian typography)
5. `list-to-table` — Markdown lists → `<table>`
6. `ref` — `((ref-id))` → content from reference files
7. `stats-insert` — inline stat blocks → HTML
8. `linkify` — `(A4)` style room refs → `<a>` links

### PDF Build (`build-pdf.ts`)

Four phases per document:

1. **DOM setup** (`preparePdfHtml`) — single browser: builds TOC, wraps content sections, estimates page count,
   serialises final HTML
2. **Chunk rendering** — launches `N` Puppeteer instances in parallel, each renders the full HTML with a different
   `pageRanges` slice
3. **Merge** — pdf-lib merges chunks, rebuilds `/Catalog/Dests` named destinations so cross-chunk links work, draws
   header/footer
4. **TOC patching** — (gated: `BUILD_TOC_PAGENUMS`) injects real page numbers into TOC, re-renders only TOC pages,
   splices them into the merged PDF

**Incremental chunk cache:** chunk PDFs saved to `build/pdf/{documentId}-chunk-{i}.pdf`; a registry at
`build/pdf/{documentId}-registry.json` stores N, chunkSize, and MD5 hashes of every source file. On subsequent builds:

- **Fast path** (all files unchanged + N/chunkSize known from config): skips Puppeteer entirely, loads cached chunks,
  merges. Disabled when `BUILD_TOC_PAGENUMS` is set.
- **Partial rebuild**: re-renders only the chunk(s) containing changed files (chunk assignment is by file position,
  approximate but conservative).

### Config (`types.ts` + `conf/oktozin.build.conf.ts`)

`IModuleBuilderConfig` has top-level defaults plus a `documents` array of `IDocumentConfig`. `build-module.ts`
deep-merges each document config with the defaults before passing to the build functions.

Config is loaded from `oktozin.build.conf.ts` at the project root or in `conf/`, or via `--config`. The
`releasedocumentIds` array controls which documents are included in release builds.

### Two-Language Output

Documents with `id: 'main'` and `id: 'osr'` share identical content but use `conditionals` macro to swap system-specific
text. The `conditionalsAlias` config field maps document IDs for bestiary variants.

## Code Style

- All functions are arrow functions (enforced by `func-style: expression`)
- No `console.log` — use the `logger` from `lib/logger.ts`
- Imports sorted by `simple-import-sort`; node builtins first, then third-party, then local
- `no-implicit-coercion` is enforced — use `Number(x)` not `+x`, `String(x)` not `${x}`
- Follows the `.eslintrc.json` rules
