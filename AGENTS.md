# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Codex, etc.) when working with code in this repository.
Claude Code reads it via the `@AGENTS.md` import in [CLAUDE.md](CLAUDE.md); other tools read it directly.

## Context

This repo **is** `oktozine`, the npm package that converts Markdown → HTML → PDF (CLI entrypoint `oktozine`, published
from `dist/`, built from `src/`). User-facing docs — CLI flags, config schema, macro syntax, environment variables,
frontmatter keys — live in [Readme.md](Readme.md); read that first. This file covers only what's specific to developing
the library itself and isn't already in the README.

## Commands

```bash
yarn build          # tsup — compiles src/ to dist/ (what actually gets published)
yarn test           # run all tests
yarn tsc            # type-check only, no emit
yarn lint           # eslint
yarn format         # prettier --check
yarn format:fix     # eslint --fix && prettier --write

# Run a single test file
NODE_OPTIONS=--experimental-vm-modules npx jest src/path/to/file.test.ts
```

To exercise the CLI itself (`oktozine`, `oktozine server start|stop`, the build config schema), see Readme.md's Quick
Start / CLI / Build Config sections.

## Architecture

Source lives in `src/`:

- `build-module.ts` — CLI entrypoint (`bin: oktozine`); deep-merges each document config over the top-level defaults
  before building
- `build-html.ts` / `build-pdf.ts` — the two build phases; see Readme's "Build phases" for the user-facing overview
- `lib/` — config loading, path resolution, logger, PDF chunk cache/registry, embedded web server daemon, TOC builder
- `macros/` — the Markdown macro pipeline; `index.ts` registers each macro in a fixed order. **Don't duplicate the
  pipeline table or per-macro syntax here** — Readme's "Markdown Macro System" section is the single source of truth;
  update it there when macros change.

### PDF build phases (`build-pdf.ts`) — not covered in Readme.md

Four phases per document:

1. **DOM setup** (`preparePdfHtml`) — single browser: builds TOC, wraps content sections, estimates page count,
   serialises final HTML
2. **Chunk rendering** — launches `N` Puppeteer instances in parallel, each renders the full HTML with a different
   `pageRanges` slice
3. **Merge** — pdf-lib merges chunks, rebuilds `/Catalog/Dests` named destinations so cross-chunk links work, draws
   header/footer
4. **TOC patching** — (gated: `BUILD_TOC_PAGENUMS`) injects real page numbers into TOC, re-renders only TOC pages,
   splices them into the merged PDF; experimental and slow

### Caching internals — not covered in Readme.md

- **HTML incremental cache:** tracks a last-build timestamp in `/tmp/HTML_BUILDER_LAST_BUILD$-{id}.txt`
  (`src/lib/build-utils.ts`); files whose `mtime` predates it are skipped. `--html-no-skip` forces a full rebuild.
- **PDF chunk cache:** chunk PDFs are saved to `build/pdf/{documentId}-chunk-{i}.pdf`; a registry at
  `build/pdf/{documentId}-registry.json` (`src/lib/pdf-chunk-registry.ts`) stores `N`, `chunkSize`, and MD5 hashes of
  every source file.
  - Fast path (all files unchanged + N/chunkSize known from config): skips Puppeteer entirely, loads cached chunks,
    merges. Disabled when `BUILD_TOC_PAGENUMS` is set.
  - Partial rebuild: re-renders only the chunk(s) containing changed files (chunk assignment is by file position,
    approximate but conservative).
- Errors in individual macros are caught in `macros/index.ts` and logged without aborting the rest of the pipeline.

## Code Style

- Functions are written as arrow functions by convention; ESLint enforces `prefer-arrow-callback` for callbacks
- No `console.log` — use the `logger` from `src/lib/logger.ts` (`console.warn`/`console.error` are the only allowed raw
  console calls)
- Imports sorted by `simple-import-sort`; node builtins first, then third-party, then local
- `no-implicit-coercion` is enforced — use `Number(x)` not `+x`, `String(x)` not `${x}`
- Follows the `.eslintrc.json` rules
