import { IBaseConfig } from '../../types'
import { resolveContentPaths } from '../paths'

describe('resolveContentPaths', () => {
  it('uses explicit dirs from config when provided', () => {
    const result = resolveContentPaths({
      outputPath: '/out',
      markdownDir: '/custom/md',
      templatesDir: '/custom/html',
      imagesDir: '/custom/img',
      fontsDir: '/custom/fonts',
      pageNumbersFontPath: '/custom/fonts/myfont.ttf',
    } as IBaseConfig)
    expect(result.markdownDir).toBe('/custom/md')
    expect(result.templatesDir).toBe('/custom/html')
    expect(result.pageNumbersFontPath).toBe('/custom/fonts/myfont.ttf')
  })

  it('defaults relative to projectRoot when dirs are omitted', () => {
    const result = resolveContentPaths({ outputPath: '/out', projectRoot: '/myproject' } as IBaseConfig)
    expect(result.markdownDir).toBe('/myproject/src/markdown')
    expect(result.templatesDir).toBe('/myproject/src/html')
    expect(result.imagesDir).toBe('/myproject/src/images')
    expect(result.fontsDir).toBe('/myproject/src/styles/fonts')
  })
})
