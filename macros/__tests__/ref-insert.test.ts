import { convertRefInserts } from '../ref.macro'

describe('convert ref inserts', () => {
  it('should convert cmd into shortened stats html', () => {
    expect(convertRefInserts(`<!-- cmd[ref] header[Костяная химера] /-->`)).toMatchSnapshot()
  })

  it('should convert cmd into full html', () => {
    expect(convertRefInserts(`<!-- cmd[ref] header[Костяная химера] detailed /-->`)).toMatchSnapshot()
  })

  it('should ignore not found refs', () => {
    expect(convertRefInserts(`<!-- cmd[ref] header[XXX YYY] /-->`)).toEqual(`<!-- cmd[ref] header[XXX YYY] /-->`)
  })

  it('should insert n times', () => {
    expect(
      convertRefInserts(
        `XXX <!-- cmd[ref] header[Костяная химера] /--> YYY <!-- cmd[ref] header[Костяная химера] /-->`,
      ),
    ).toMatchSnapshot()
  })
})
