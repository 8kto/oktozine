import type { IDocumentConfig } from '../../types'
import { parseLangBlocks } from '../lang-block.macro'

const c = (buildLang?: string): IDocumentConfig => ({ id: 'main', buildLang }) as unknown as IDocumentConfig

describe('parses {% lang %} blocks', () => {
  it('should keep content of the block matching buildLang', () => {
    expect(
      parseLangBlocks(`{% lang en %}\n  Hello\n{% /lang %}\n{% lang ru %}\n  Привет\n{% /lang %}`, c('en')).trim(),
    ).toEqual('Hello')
  })

  it('should keep the matching block when it is not the first one', () => {
    expect(
      parseLangBlocks(`{% lang en %}\n  Hello\n{% /lang %}\n{% lang ru %}\n  Привет\n{% /lang %}`, c('ru')).trim(),
    ).toEqual('Привет')
  })

  it('should drop the block entirely when no language matches', () => {
    expect(
      parseLangBlocks(`{% lang en %}\n  Hello\n{% /lang %}\n{% lang ru %}\n  Привет\n{% /lang %}`, c('de')).trim(),
    ).toEqual('')
  })

  it('should default buildLang to "en" when unset', () => {
    expect(
      parseLangBlocks(`{% lang en %}\n  Hello\n{% /lang %}\n{% lang ru %}\n  Привет\n{% /lang %}`, {
        id: 'main',
      } as IDocumentConfig).trim(),
    ).toEqual('Hello')
  })

  it('should preserve raw HTML content inside the block', () => {
    expect(
      parseLangBlocks(
        `{% lang en %}\n  <span class="cover-title--subtitle">In the Eye of</span> Vargothar\n{% /lang %}\n{% lang ru %}\n  Зеница Варготара\n{% /lang %}`,
        c('en'),
      ).trim(),
    ).toEqual('<span class="cover-title--subtitle">In the Eye of</span> Vargothar')
  })

  it('should handle multiple independent lang-block groups in the same document', () => {
    const input = `{% lang en %}A{% /lang %}{% lang ru %}Б{% /lang %} middle {% lang en %}C{% /lang %}{% lang ru %}Д{% /lang %}`
    expect(parseLangBlocks(input, c('en'))).toEqual('A middle C')
  })

  it('should leave markdown unchanged if there are no lang blocks', () => {
    const input = 'No macros here.'
    expect(parseLangBlocks(input, c('en'))).toEqual(input)
  })
})
