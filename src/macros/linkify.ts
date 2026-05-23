/**
 * @file Auto-links room references and converts room headers into anchored
 * heading elements.
 *
 * Two passes are applied sequentially:
 *
 * 1. **`linkRooms`** — inline parenthesised room codes like `(A4)` become
 *    clickable links pointing to the room's heading anchor.
 * 2. **`linkHeaders`** — Markdown headings that start with a room code
 *    (e.g. `## A2. Throne Room`) are converted to HTML headings with a
 *    stable `id` derived from the code.
 *
 * The set of accepted area prefixes is configurable via `config.chapterRefPattern`
 * (a regex character class body, e.g. `'A-FPQS'`). Set to `null` to disable
 * room linking entirely. Defaults to `'A-FPQS'`.
 *
 * @module macros/linkify
 *
 * @example Inline room reference
 * ```markdown
 * The passage leads to (A4).
 * ↓ becomes ↓
 * The passage leads to <a class="linkified" target="_self" href="#room-a4">(A4)</a>.
 * ```
 *
 * @example Room heading
 * ```markdown
 * ## A2. Throne Room
 * ↓ becomes ↓
 * <h2 id="room-a2">A2. Throne Room</h2>
 * ```
 */

import type { MacroFn } from '../types'

/**
 * Convert a room reference code to a DOM id (lowercase, prefixed with `room-`).
 *
 * @param ref - Room code, e.g. `"A4"`, `"S12"`.
 * @returns Anchor id, e.g. `"room-a4"`, `"room-s12"`.
 */
const convertChapterRefToLink = (ref: string): string => `room-${ref.toLowerCase()}`

/**
 * Replace every parenthesised room code `(X##)` with a clickable anchor link.
 *
 * @param text - Source Markdown string.
 * @param pattern - Regex character class body, e.g. `'A-FPQS'`.
 * @returns Markdown with inline room codes linked.
 */
const linkChapters = (text: string, pattern: string): string => {
  const chapterRefRegex = new RegExp(`\\(([${pattern}]\\d+)\\)`, 'g')

  return text.replace(chapterRefRegex, (_match, roomRef: string) => {
    const id = convertChapterRefToLink(roomRef)

    return `<a class="linkified" target="_self" href="#${id}">(${roomRef})</a>`
  })
}

/**
 * Convert Markdown headings that begin with a room code into HTML headings
 * with a stable `id` attribute.
 *
 * Matches lines like `## A2. Throne Room` or `### S1. Engine Bay`.
 *
 * @param text - Source Markdown string.
 * @returns Markdown with room headings replaced by explicit HTML heading tags.
 */
const linkHeaders = (text: string): string => {
  const headerRegex = /^(#+)\s([A-FPQS]\d+)\.\s(.+)$/gm

  return text.replace(headerRegex, (_match, hashes: string, roomRef: string, headerText: string) => {
    const level = hashes.length
    const id = convertChapterRefToLink(roomRef)

    return `<h${level} id="${id}">${roomRef}. ${headerText}</h${level}>`
  })
}

/**
 * Auto-link room references and room headings in the Markdown source.
 *
 * Runs {@link linkChapters} then {@link linkHeaders} sequentially.
 * Set `config.chapterRefPattern` to a regex character class body (e.g. `'A-FPQS'`)
 * to control which codes are matched, or `null` to skip linking entirely.
 */
export const linkify: MacroFn = (markdown, config) => {
  if (config.chapterRefPattern === null) {
    return markdown
  }
  const pattern = config.chapterRefPattern ?? 'A-K'

  return linkHeaders(linkChapters(markdown, pattern))
}
