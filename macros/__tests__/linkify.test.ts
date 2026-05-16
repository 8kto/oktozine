import type { IDocumentConfig } from '../../types'
import { linkify } from '../linkify'

const defaultConf = {} as IDocumentConfig

describe('linkify tests', () => {
  it('should linkify room references', () => {
    expect(
      linkify(
        `
        - Катакомбы, где хоронят Посвящённых (F1)
        - Галерея с женскими бюстами (F5)
        - Галерея X1 (X1)
        - Галерея F1 (F1)
        - Коридор Q2 (Q2)
      `,
        defaultConf,
      ).trim(),
    ).toEqual(
      `
        - Катакомбы, где хоронят Посвящённых <a class="linkified" target="_self" href="#room-f1">(F1)</a>
        - Галерея с женскими бюстами <a class="linkified" target="_self" href="#room-f5">(F5)</a>
        - Галерея X1 (X1)
        - Галерея F1 <a class="linkified" target="_self" href="#room-f1">(F1)</a>
        - Коридор Q2 <a class="linkified" target="_self" href="#room-q2">(Q2)</a>
    `.trim(),
    )
  })

  it('should linkify headers', () => {
    expect(
      linkify(
        `
# A1. Зал с саркофагом
Галерея с женскими бюстами

## B1. Шахта
### C1. Шахта
Галерея F1

### C2. Вход
### A. Вход
      `,
        defaultConf,
      ).trim(),
    ).toEqual(
      `
<h1 id="room-a1">A1. Зал с саркофагом</h1>
Галерея с женскими бюстами

<h2 id="room-b1">B1. Шахта</h2>
<h3 id="room-c1">C1. Шахта</h3>
Галерея F1

<h3 id="room-c2">C2. Вход</h3>
### A. Вход
    `.trim(),
    )
  })

  it('should support all linking targets', () => {
    expect(
      linkify(
        `
### D55. Ловушка захлопнулась

Вода сначала зальёт Зал с кошками (B5) и Сокровищницу (B6), а когда гравитация станет обычной — провалится дальше в залы
(B7), (B8) и (B9) по направлению к залу с Колесом Силы.
      `,
        defaultConf,
      ).trim(),
    ).toEqual(
      `
<h3 id="room-d55">D55. Ловушка захлопнулась</h3>

Вода сначала зальёт Зал с кошками <a class="linkified" target="_self" href="#room-b5">(B5)</a> и Сокровищницу <a class="linkified" target="_self" href="#room-b6">(B6)</a>, а когда гравитация станет обычной — провалится дальше в залы
<a class="linkified" target="_self" href="#room-b7">(B7)</a>, <a class="linkified" target="_self" href="#room-b8">(B8)</a> и <a class="linkified" target="_self" href="#room-b9">(B9)</a> по направлению к залу с Колесом Силы.
    `.trim(),
    )
  })
})

describe('linkify chapterRefPattern config', () => {
  it('uses custom chapterRefPattern from config when provided', () => {
    const conf = { chapterRefPattern: 'X\\d+' } as unknown as IDocumentConfig
    const input = 'Go to (X12) or (A4).'
    const result = linkify(input, conf)
    expect(result).toContain('href="#room-x12"')
    expect(result).not.toContain('href="#room-a4"')
  })

  it('uses default pattern when chapterRefPattern is absent', () => {
    const input = 'Go to (A4).'
    const result = linkify(input, defaultConf)
    expect(result).toContain('href="#room-a4"')
  })

  it('skips room linking when chapterRefPattern is null', () => {
    const conf = { chapterRefPattern: null } as unknown as IDocumentConfig
    const input = 'Go to (A4).'
    const result = linkify(input, conf)
    expect(result).toBe(input)
  })
})
