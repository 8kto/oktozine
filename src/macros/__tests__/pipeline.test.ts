import type { IDocumentConfig, MacroFn } from '../../types'
import handleMacros from '../index'

const baseConf: IDocumentConfig = {
  id: 'main',
  outputPath: '/tmp',
  shouldRebuildHtml: false,
}

it('runs custom macros from config after the built-in pipeline', () => {
  const customMacro: MacroFn = (md) => md.replace('BEFORE', 'AFTER')
  const conf: IDocumentConfig = { ...baseConf, macros: [customMacro] }
  expect(handleMacros('BEFORE', conf)).toBe('AFTER')
})

it('built-in pipeline runs unchanged when config has no custom macros', () => {
  expect(handleMacros('', baseConf)).toBe('')
})
