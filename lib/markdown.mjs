import MarkdownIt from 'markdown-it'
import markdownItIns from 'markdown-it-ins'

export const getMarkdownRenderer = () =>
  new MarkdownIt({
    // Enable HTML tags in source
    html: true,

    // Use '/' to close single tags (<br />).
    // This is only for full CommonMark compatibility.
    xhtmlOut: true,

    // Convert '\n' in paragraphs into <br>
    // breaks: true,

    // Autoconvert URL-like text to links
    linkify: false,

    // Enable some language-neutral replacement + quotes beautification
    // For the full list of replacements, see https://github.com/markdown-it/markdown-it/blob/master/lib/rules_core/replacements.js
    typographer: true,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Could be either a String or an Array.
    //
    // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
    // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
    quotes: '«»„“',
  })
    // enables ++string++ => <ins>string</ins>
    .use(markdownItIns)
