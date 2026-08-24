import { IBaseConfig } from '../../types'
import { getCssPath, resolveContentPaths } from '../paths'

describe('getCssPath', () => {
  it('returns default output.css path when cssPath not set', () => {
    expect(getCssPath({ outputPath: '/build' })).toBe('/build/output.css')
  })

  it('returns explicit cssPath when provided', () => {
    expect(getCssPath({ outputPath: '/build', cssPath: '/custom/styles.css' })).toBe('/custom/styles.css')
  })
})

describe('resolveContentPaths', () => {
  it('uses explicit dirs from config when provided', () => {
    const result = resolveContentPaths({
      outputPath: '/out',
      markdownPath: '/custom/md',
      templatesDir: '/custom/html',
      imagesDir: '/custom/img',
      fontsDir: '/custom/fonts',
      pageNumbersFontPath: '/custom/fonts/myfont.ttf',
    } as IBaseConfig)
    expect(result.markdownPath).toBe('/custom/md')
    expect(result.templatesDir).toBe('/custom/html')
    expect(result.pageNumbersFontPath).toBe('/custom/fonts/myfont.ttf')
  })

  it('defaults relative to projectRoot when dirs are omitted', () => {
    const result = resolveContentPaths({ outputPath: '/out', projectRoot: '/myproject' } as IBaseConfig)
    expect(result.markdownPath).toBe('/myproject/src/markdown')
    expect(result.templatesDir).toBe('/myproject/src/html')
    expect(result.imagesDir).toBe('/myproject/src/images')
    expect(result.fontsDir).toBe('/myproject/src/styles/fonts')
  })
})
