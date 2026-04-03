/**
 * @file Convert room references to links:
 *   - headers "## A2. Room" → <h2 id="room-a2">
 *   - inline refs "(A4)" → <a href="#room-a4">(A4)</a>
 */

const convertRoomRefToLink = (ref: string): string => `room-${ref.toLowerCase()}`

const linkRooms = (text: string): string => {
  // FIXME config
  const roomRefRegex = /\(([A-FPQS]\d+)\)/g

  return text.replace(roomRefRegex, (_match, roomRef: string) => {
    const id = convertRoomRefToLink(roomRef)
    return `<a class="linkified" target="_self" href="#${id}">(${roomRef})</a>`
  })
}

const linkHeaders = (text: string): string => {
  const headerRegex = /^(#+)\s([A-FPQS]\d+)\.\s(.+)$/gm

  return text.replace(headerRegex, (_match, hashes: string, roomRef: string, headerText: string) => {
    const level = hashes.length
    const id = convertRoomRefToLink(roomRef)
    return `<h${level} id="${id}">${roomRef}. ${headerText}</h${level}>`
  })
}

export const linkify = (markdown: string): string => {
  return [linkRooms, linkHeaders].reduce((acc, fn) => fn(acc), markdown)
}
