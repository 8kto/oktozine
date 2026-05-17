import type { IDocumentConfig } from '../../types'
import { convertRefInserts } from '../ref.macro'

const config = {} as IDocumentConfig

describe('convert ref inserts', () => {
  it('should convert cmd into shortened stats html', () => {
    expect(convertRefInserts(`<!-- cmd[ref] header[Костяная химера] /-->`, config)).toMatchSnapshot()
  })

  it('should convert cmd into full html', () => {
    expect(convertRefInserts(`<!-- cmd[ref] header[Костяная химера] detailed /-->`, config)).toMatchSnapshot()
  })

  it('should ignore not found refs', () => {
    expect(convertRefInserts(`<!-- cmd[ref] header[XXX YYY] /-->`, config)).toEqual(`<!-- cmd[ref] header[XXX YYY] /-->`)
  })

  it('should insert n times', () => {
    expect(
      convertRefInserts(
        `XXX <!-- cmd[ref] header[Костяная химера] /--> YYY <!-- cmd[ref] header[Костяная химера] /-->`,
        config,
      ),
    ).toMatchSnapshot()
  })
})
