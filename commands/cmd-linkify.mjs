#!/usr/bin/env node

/**
 * @file Convert room references to the links:
 *    - headers that look like `## A2. Room` are parsed and converted to the HTML headers with `id=$roomRef`
 *    - room refs in texts that look like `... leads to the Cats Hall (A4)` are converted to the HTML links
 */

/**
 * @param {string} ref
 * @returns {string}
 */
const convertRoomRefToLink = (ref) => {
  return `room-${ref.toLowerCase()}`
}

/**
 * Handler #1: replace all inline room references "(X1)" → <a …>(X1)</a>
 * Works on the full text in one global pass.
 * @param {string} text
 * @returns {string}
 */
const linkRooms = (text) => {
  const roomRefRegex = /\(([A-FPQS]\d+)\)/g

  return text.replace(roomRefRegex, (_match, roomRef) => {
    const id = convertRoomRefToLink(roomRef)

    return `<a class="linkified" target="_self" href="#${id}">(${roomRef})</a>`
  })
}

/**
 * Handler #2: replace all headers "## A1. Title" → <h2 id="room-a1">A1. Title</h2>
 * Works on the full text with the `m` (multiline) flag.
 * @param {string} text
 * @returns {string}
 */
const linkHeaders = (text) => {
  const headerRegex = /^(#+)\s([A-FPQS]\d+)\.\s(.+)$/gm

  return text.replace(headerRegex, (_match, hashes, roomRef, headerText) => {
    const level = hashes.length
    const id = convertRoomRefToLink(roomRef)

    return `<h${level} id="${id}">${roomRef}. ${headerText}</h${level}>`
  })
}

/**
 * @type {CommandHandlerFn}
 * @param {string} markdown
 * @returns {string}
 */
export const linkify = (markdown) => {
  const processors = [linkRooms, linkHeaders]

  return processors.reduce((acc, fn) => fn(acc), markdown)
}
