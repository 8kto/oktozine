export interface IRenderReferenceBlockOptions {
  idAttr?: string
  hasAlternateLook?: boolean
  hasAlternateHeader?: boolean
  title: string
  content: string
  headerTagName?: string | null
  shouldWrap?: boolean
  hasNoHeader?: boolean
}

export const handleLists = (content: string): string => {
  return content.replace(/^-\s\*\*(.+?)\*\*/gm, (_, title) => {
    return `- <em class="damage-prop">${title}</em>`
  })
}

export const renderReferenceBlock = ({
  idAttr = '',
  hasAlternateLook = false,
  hasAlternateHeader = false,
  title,
  content,
  headerTagName = null,
  shouldWrap = false,
  hasNoHeader = false,
}: IRenderReferenceBlockOptions): string => {
  const htag = !headerTagName ? 'header' : headerTagName
  const headerClasses = `ref-header ${hasAlternateHeader ? 'ref-header--alt' : ''}`
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
    '',
    handleLists(content),
    `</main>`,
    `</section>`,
  ]

  return lines.join('\n')
}
