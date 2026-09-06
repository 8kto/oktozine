import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { IDocumentConfig } from '../../types'
import { convertDumpInserts } from '../dump.macro'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const config = { markdownPath: path.join(dirname, 'fixtures') } as IDocumentConfig

const extractTitles = (html: string): string[] =>
  Array.from(html.matchAll(/<h3 class="ref-header ?">([^<]+)<\/h3>/g)).map((match) => match[1])

describe('convert dump inserts', () => {
  it('should dump all entries in file order when sorted is not passed', () => {
    const result = convertDumpInserts(`<!-- cmd[dump] ref-file[$refs-dump-test] /-->`, config)

    expect(extractTitles(result)).toEqual(['Zebra', 'Apple', 'Mango'])
    expect(result).toMatchSnapshot()
  })

  it('should sort entries ascending when sorted is passed bare', () => {
    const result = convertDumpInserts(`<!-- cmd[dump] ref-file[$refs-dump-test] sorted /-->`, config)

    expect(extractTitles(result)).toEqual(['Apple', 'Mango', 'Zebra'])
  })

  it('should sort entries ascending when sorted[asc] is passed', () => {
    const result = convertDumpInserts(`<!-- cmd[dump] ref-file[$refs-dump-test] sorted[asc] /-->`, config)

    expect(extractTitles(result)).toEqual(['Apple', 'Mango', 'Zebra'])
  })

  it('should sort entries descending when sorted[desc] is passed', () => {
    const result = convertDumpInserts(`<!-- cmd[dump] ref-file[$refs-dump-test] sorted[desc] /-->`, config)

    expect(extractTitles(result)).toEqual(['Zebra', 'Mango', 'Apple'])
  })

  it('should ignore not found ref files', () => {
    expect(convertDumpInserts(`<!-- cmd[dump] ref-file[$refs-does-not-exist] /-->`, config)).toEqual(
      `<!-- cmd[dump] ref-file[$refs-does-not-exist] /-->`,
    )
  })
})
