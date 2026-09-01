import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals'

import { IDocumentPage } from '../types'

const mockReadFile = jest.fn<(path: string, encoding: BufferEncoding) => Promise<string>>()

jest.unstable_mockModule('fs-extra', () => ({
  default: {
    readFile: mockReadFile,
  },
}))

const { applyTemplate } = await import('../build-html')
const { MetadataUseKeys } = await import('../types')

const createPage = (content = 'Page content', metadata: Partial<IDocumentPage['metadata']> = {}): IDocumentPage => ({
  content,
  metadata: {
    id: 'test-document',
    outputPath: '/tmp/output',
    shouldRebuildHtml: false,
    ...metadata,
  },
})

describe('build-html', () => {
  describe('applyTemplate', () => {
    const originalLang = process.env.OB_LANG

    beforeEach(() => {
      jest.clearAllMocks()

      mockReadFile.mockResolvedValue('<html>{{content}}</html>')
    })

    afterAll(() => {
      if (originalLang === undefined) {
        delete process.env.OB_LANG
      } else {
        process.env.OB_LANG = originalLang
      }
    })

    describe('basic template replacements', () => {
      it('replaces header, footer and content', async () => {
        mockReadFile.mockResolvedValue(
          '<header>{{header}}</header>' + '<main>{{content}}</main>' + '<footer>{{footer}}</footer>',
        )

        const page = createPage('<p>Hello</p>', {
          header: 'Header',
          footer: 'Footer',
        })

        const result = await applyTemplate(page, '/template.html')

        expect(result).toBe('<header>Header</header>' + '<main><p>Hello</p></main>' + '<footer>Footer</footer>')

        expect(mockReadFile).toHaveBeenCalledWith('/template.html', 'utf8')
      })

      it('replaces missing header and footer with empty strings', async () => {
        mockReadFile.mockResolvedValue('<header>{{header}}</header><footer>{{footer}}</footer>')

        const result = await applyTemplate(createPage(), '/template.html')

        expect(result).toBe('<header></header><footer></footer>')
      })

      it('replaces version when requested', async () => {
        mockReadFile.mockResolvedValue('<div>{{version}}</div>')

        const page = createPage('Page content', {
          use: [MetadataUseKeys.version],
        })

        const result = await applyTemplate(page, '/template.html')

        expect(result).toContain('<div>')
      })

      it('replaces document title when requested', async () => {
        mockReadFile.mockResolvedValue('<title>{{documentTitle}}</title>')

        const page = createPage('Page content', {
          documentTitle: 'My document',
          use: [MetadataUseKeys.documentTitle],
        })

        const result = await applyTemplate(page, '/template.html')

        expect(result).toBe('<title>My document</title>')
      })

      it('replaces build mode with empty string in production', async () => {
        mockReadFile.mockResolvedValue('<div>{{buildMode}}</div>')

        const page = createPage('Page content', {
          isProduction: true,
          use: [MetadataUseKeys.buildMode],
        })

        const result = await applyTemplate(page, '/template.html')

        expect(result).toBe('<div></div>')
      })

      it('replaces build mode with draft watermark in non-production', async () => {
        mockReadFile.mockResolvedValue('<div>{{buildMode}}</div>')

        const page = createPage('Page content', {
          isProduction: false,
          draftWatermarkHtml: '<strong>DRAFT</strong>',
          use: [MetadataUseKeys.buildMode],
        })

        const result = await applyTemplate(page, '/template.html')

        expect(result).toBe('<div><strong>DRAFT</strong></div>')
      })

      it('replaces document name placeholder', async () => {
        mockReadFile.mockResolvedValue('<div data-id-placeholder></div>')

        const page = createPage('Page content', {
          name: 'chapter-1',
        })

        const result = await applyTemplate(page, '/template.html')

        expect(result).toBe('<div id="chapter-1" data-id="chapter-1"></div>')
      })

      it('replaces picture id', async () => {
        mockReadFile.mockResolvedValue('<img src="{{pictureId}}">')

        const page = createPage('Page content', {
          'picture-id': 'picture-123',
        })

        const result = await applyTemplate(page, '/template.html')

        expect(result).toBe('<img src="picture-123">')
      })
    })

    describe('localized templates', () => {
      it('renders Russian translation when OB_LANG is ru', async () => {
        process.env.OB_LANG = 'ru'

        mockReadFile.mockResolvedValue('<h1>{{ ru="Русский заголовок" en="English title" }}</h1>')

        const result = await applyTemplate(createPage(), '/template.html')

        expect(result).toBe('<h1>Русский заголовок</h1>')
      })

      it('renders English translation when OB_LANG is en', async () => {
        process.env.OB_LANG = 'en'

        mockReadFile.mockResolvedValue('<h1>{{ ru="Русский заголовок" en="English title" }}</h1>')

        const result = await applyTemplate(createPage(), '/template.html')

        expect(result).toBe('<h1>English title</h1>')
      })

      it('supports multiple localized expressions in one template', async () => {
        process.env.OB_LANG = 'ru'

        mockReadFile.mockResolvedValue(`
          <h1>{{ ru="Заголовок" en="Title" }}</h1>
          <p>{{ ru="Описание" en="Description" }}</p>
        `)

        const result = await applyTemplate(createPage(), '/template.html')

        expect(result).toBe(`
          <h1>Заголовок</h1>
          <p>Описание</p>
        `)
      })

      it('supports locales with hyphens', async () => {
        process.env.OB_LANG = 'pt-BR'

        mockReadFile.mockResolvedValue('<p>{{ ru="Русский" en="English" pt-BR="Português brasileiro" }}</p>')

        const result = await applyTemplate(createPage(), '/template.html')

        expect(result).toBe('<p>Português brasileiro</p>')
      })

      it('supports whitespace inside the localized expression', async () => {
        process.env.OB_LANG = 'en'

        mockReadFile.mockResolvedValue('<p>{{   ru = "Русский"   en = "English"   }}</p>')

        const result = await applyTemplate(createPage(), '/template.html')

        expect(result).toBe('<p>English</p>')
      })

      it('supports empty translation values', async () => {
        process.env.OB_LANG = 'ru'

        mockReadFile.mockResolvedValue('<p>{{ ru="" en="English" }}</p>')

        const result = await applyTemplate(createPage(), '/template.html')

        expect(result).toBe('<p></p>')
      })

      it('throws when language is not set', async () => {
        delete process.env.OB_LANG

        mockReadFile.mockResolvedValue('<p>{{ ru="Русский" en="English" }}</p>')

        await expect(applyTemplate(createPage(), '/template.html')).rejects.toThrow('Language is not set')
      })

      it('throws when requested locale is missing', async () => {
        process.env.OB_LANG = 'de'

        mockReadFile.mockResolvedValue('<p>{{ ru="Русский" en="English" }}</p>')

        await expect(applyTemplate(createPage(), '/template.html')).rejects.toThrow(
          'Missing translation for locale "de"',
        )
      })

      it('does not modify ordinary template expressions', async () => {
        process.env.OB_LANG = 'ru'

        mockReadFile.mockResolvedValue('<p>{{header}}</p><p>{{someVariable}}</p>')

        const result = await applyTemplate(createPage(), '/template.html')

        expect(result).toBe('<p></p><p>{{someVariable}}</p>')
      })
    })
  })
})
