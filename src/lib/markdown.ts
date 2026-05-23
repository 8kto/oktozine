import MarkdownIt from 'markdown-it'
import markdownItIns from 'markdown-it-ins'

export const getMarkdownRenderer = (): MarkdownIt =>
  new MarkdownIt({
    html: true,
    xhtmlOut: true,
    linkify: false,
    typographer: true,
    quotes: '«»„"',
  }).use(markdownItIns)
