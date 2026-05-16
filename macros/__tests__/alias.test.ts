import type { IDocumentConfig } from '../../types'
import { addAliases } from '../alias'

describe('alias cmd tests', () => {
  const defaultCondig = { id: 'main' } as IDocumentConfig

  it.each([[`<!-- item[Щит Викинга] /-->`, `<!-- cmd[ref] header[Щит Викинга] detailed   /-->`]])(
    'should resolve alias for %s',
    (input, expected) => {
      expect(addAliases(input, defaultCondig)).toEqual(expected)
    },
  )

  it.each([
    [
      `<!-- item[Щит Викинга] /--> <!-- item[Лук Викинга] /-->`,
      `<!-- cmd[ref] header[Щит Викинга] detailed   /--> <!-- cmd[ref] header[Лук Викинга] detailed   /-->`,
    ],
  ])('should support multiple indices for %s', (input, expected) => {
    expect(addAliases(input, defaultCondig)).toEqual(expected)
  })

  it.each([
    [`<!-- stats[Скорпион] /-->`, `<!-- cmd[ref] header[Скорпион] detailed   /-->`],
    [`<!-- stats[Чёрная Гниль] /-->`, `<!-- cmd[ref] header[Чёрная Гниль] detailed   /-->`],
  ])('should resolve alias for %s', (input, expected) => {
    expect(addAliases(input, defaultCondig)).toEqual(expected)
  })

  it.each([
    [`<!-- span-all-columns /-->`, `<div class="span-all-columns">&nbsp;</div>`],
    [`Test pre <!-- span-all-columns /--> Test post`, `Test pre <div class="span-all-columns">&nbsp;</div> Test post`],
  ])('should support %s', (input, expected) => {
    expect(addAliases(input, defaultCondig)).toEqual(expected)
  })

  it('should insert n times', () => {
    expect(
      addAliases(`XXX<!-- stats[Костяная химера] /--> YYY <!-- stats[Костяная химера] /-->`, defaultCondig),
    ).toEqual(
      `XXX<!-- cmd[ref] header[Костяная химера] detailed   /--> YYY <!-- cmd[ref] header[Костяная химера] detailed   /-->`,
    )
  })

  it('applies aliases from config when provided', () => {
    const conf = {
      aliases: [['((Foo))', '<!-- cmd[ref] header[Foo] /-->']],
    } as unknown as IDocumentConfig
    const result = addAliases('See ((Foo)) for details.', conf)
    expect(result).toContain('cmd[ref] header[Foo]')
  })

  it('returns input unchanged when config has no aliases', () => {
    const conf = { aliases: [] } as unknown as IDocumentConfig
    const input = 'No aliases here.'
    expect(addAliases(input, conf)).toBe(input)
  })

  it('should handle IF blocks', () => {
    expect(
      addAliases(
        `
      <!-- cmd:if[osr] -->

      Змея видит будущее на секунду вперёд, поэтому у неё повышенный Класс Брони (AC), а также бонус к атаке (to-hit) +6.

      <!-- /cmd:if -->

      <!-- cmd:if[main] -->

      Змея видит будущее на секунду вперёд, поэтому уклонение от её атак происходит с помехой, так же как и атаки по ней
      самой.

      <!-- /cmd -->
    `.trim(),
        defaultCondig,
      ),
    ).toEqual(
      `
    <div class="conditional-block conditional-block--osr">

      Змея видит будущее на секунду вперёд, поэтому у неё повышенный Класс Брони (AC), а также бонус к атаке (to-hit) +6.

      </div>

      <div class="conditional-block conditional-block--main">

      Змея видит будущее на секунду вперёд, поэтому уклонение от её атак происходит с помехой, так же как и атаки по ней
      самой.

      <!-- /cmd -->
    `.trim(),
    )
  })
})
