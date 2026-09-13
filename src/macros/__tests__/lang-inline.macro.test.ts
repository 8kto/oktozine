import { afterAll, beforeEach, describe, expect, it } from '@jest/globals'

import { resolveInlineTranslations } from '../lang-inline.macro'

describe('resolveInlineTranslations', () => {
  const originalLang = process.env.OB_LANG

  beforeEach(() => {
    delete process.env.OB_LANG
  })

  afterAll(() => {
    if (originalLang === undefined) {
      delete process.env.OB_LANG
    } else {
      process.env.OB_LANG = originalLang
    }
  })

  it('renders the translation matching OB_LANG', () => {
    process.env.OB_LANG = 'ru'
    expect(resolveInlineTranslations('<h1>{{ ru="Русский заголовок" en="English title" }}</h1>')).toBe(
      '<h1>Русский заголовок</h1>',
    )
  })

  it('renders a different locale when OB_LANG differs', () => {
    process.env.OB_LANG = 'en'
    expect(resolveInlineTranslations('<h1>{{ ru="Русский заголовок" en="English title" }}</h1>')).toBe(
      '<h1>English title</h1>',
    )
  })

  it('supports multiple expressions in one string', () => {
    process.env.OB_LANG = 'ru'
    expect(
      resolveInlineTranslations(`<h1>{{ ru="Заголовок" en="Title" }}</h1><p>{{ ru="Описание" en="Description" }}</p>`),
    ).toBe('<h1>Заголовок</h1><p>Описание</p>')
  })

  it('supports locales with hyphens', () => {
    process.env.OB_LANG = 'pt-BR'
    expect(resolveInlineTranslations('<p>{{ ru="Русский" en="English" pt-BR="Português brasileiro" }}</p>')).toBe(
      '<p>Português brasileiro</p>',
    )
  })

  it('supports whitespace inside the expression', () => {
    process.env.OB_LANG = 'en'
    expect(resolveInlineTranslations('<p>{{   ru = "Русский"   en = "English"   }}</p>')).toBe('<p>English</p>')
  })

  it('supports empty translation values', () => {
    process.env.OB_LANG = 'ru'
    expect(resolveInlineTranslations('<p>{{ ru="" en="English" }}</p>')).toBe('<p></p>')
  })

  it('throws when language is not set', () => {
    expect(() => resolveInlineTranslations('<p>{{ ru="Русский" en="English" }}</p>')).toThrow('Language is not set')
  })

  it('throws when requested locale is missing', () => {
    process.env.OB_LANG = 'de'
    expect(() => resolveInlineTranslations('<p>{{ ru="Русский" en="English" }}</p>')).toThrow(
      'Missing translation for locale "de"',
    )
  })

  it('does not modify ordinary template expressions', () => {
    process.env.OB_LANG = 'ru'
    expect(resolveInlineTranslations('<p>{{header}}</p><p>{{someVariable}}</p>')).toBe(
      '<p>{{header}}</p><p>{{someVariable}}</p>',
    )
  })
})
