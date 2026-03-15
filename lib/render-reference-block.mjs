/**
 * @param {string} content
 * @returns {string}
 */
export const handleLists = (content) => {
  return content.replace(/^-\s\*\*(.+?)\*\*/gm, (_, title) => {
    return `- <em class="damage-prop">${title}</em>`
  })
}

export const renderReferenceBlock = ({
  idAttr = '',
  hasAlternateLook = false,
  hasAlernateHeader = false,
  title,
  content,
  headerTagName = null,
  shouldWrap = false,
  hasNoHeader = false,
}) => {
  const htag = !headerTagName ? 'header' : headerTagName
  const headerClasses = `ref-header ${hasAlernateHeader ? 'ref-header--alt' : ''}`
  let refInsertClasses = `ref-insert`
  if (hasAlternateLook) {
    refInsertClasses += ' alternative'
  }
  if (shouldWrap) {
    refInsertClasses += ' no-page-break'
  }

  const lines = [
    `<section${idAttr} class="${refInsertClasses}">`,
    hasNoHeader ? '' : `<${htag} class="${headerClasses}">${title}</${htag}>`,
    `<main>`,
    '', // Markdown parser for some reason requires an empty line to parse the layout entirely
    handleLists(content),
    `</main>`,
    `</section>`,
  ]

  return lines.join('\n')
}
