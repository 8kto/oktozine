import { glueDamageUnits, glueShorthands, glueUnits, glueUnitsWithNoLineBreaks, glueWords } from '../glue-units'

describe('glue units tests', () => {
  describe('glueUnits', () => {
    it.each([
      [`1 зм`, `1&nbsp;зм`],
      [`25 см`, `25&nbsp;см`],
      [`78971 мм`, `78971&nbsp;мм`],
      [`50 фунтов`, `50&nbsp;фунтов`],
    ])('should insert non-breakable spaces for %s', (input, expected) => {
      expect(glueUnits(input)).toEqual(expected)
    })

    it.each([
      [`1 зм, 25 см, 78971 мм`, `1&nbsp;зм, 25&nbsp;см, 78971&nbsp;мм`],
      [`50 фунтов и 200 фунтов`, `50&nbsp;фунтов и 200&nbsp;фунтов`],
    ])('should replace all indices for %s', (input, expected) => {
      expect(glueUnits(input)).toEqual(expected)
    })
  })

  describe('glueProbabilities', () => {
    it.each([
      [`1:6`, `<nobr>1:6</nobr>`],
      [`2:6`, `<nobr>2:6</nobr>`],
      [`3:6`, `<nobr>3:6</nobr>`],
      [`4:6`, `<nobr>4:6</nobr>`],
      [`5:6`, `<nobr>5:6</nobr>`],
    ])('should insert non-breakable spaces for %s', (input, expected) => {
      expect(glueWords(input)).toEqual(expected)
    })

    it.each([
      [
        `2:6 then 3:6, but first of all it is 1:6`,
        '<nobr>2:6</nobr> then <nobr>3:6</nobr>, but first of all it is <nobr>1:6</nobr>',
      ],
    ])('should replace all indices for %s', (input, expected) => {
      expect(glueWords(input)).toEqual(expected)
    })
  })

  describe('glueUnitsWithNoLineBreaks', () => {
    it.each([
      [`10′`, `<nobr>10′</nobr>`],
      [`33″`, `<nobr>33″</nobr>`],
    ])('should insert non-breakable spaces for %s', (input, expected) => {
      expect(glueUnitsWithNoLineBreaks(input)).toEqual(expected)
    })

    it.each([[`10′ x 33″`, `<nobr>10′</nobr> x <nobr>33″</nobr>`]])(
      'should replace all indices for %s',
      (input, expected) => {
        expect(glueUnitsWithNoLineBreaks(input)).toEqual(expected)
      },
    )
  })

  describe('glueDamageUnits', () => {
    it.each([
      [`d6 урона`, `d6&nbsp;урона`],
      [`d6! урона`, `d6!&nbsp;урона`],
      [`2d4 урона`, `2d4&nbsp;урона`],
      [`3d6 урону`, `3d6&nbsp;урону`],
      [`1 урона`, `1&nbsp;урона`],
      [`5 урона`, `5&nbsp;урона`],
      [`2 урон`, `2&nbsp;урон`],
      [`2d6 уроном`, `2d6&nbsp;уроном`],
      [`4d8 уронами`, `4d8&nbsp;уронами`],
      [`d6 ходов`, `d6&nbsp;ходов`],
      [`d3 хода`, `d3&nbsp;хода`],
      [`1 ход`, `1&nbsp;ход`],
      [`2 хода`, `2&nbsp;хода`],
      [`5 ходов`, `5&nbsp;ходов`],
      [`d6 (5) урона`, `d6 (5)&nbsp;урона`],
      [`d6(5) урона`, `d6(5)&nbsp;урона`],
      [`2d4 (3) ходов`, `2d4 (3)&nbsp;ходов`],
      [`d8! (10) хода`, `d8! (10)&nbsp;хода`],
    ])('should insert non-breakable spaces for %s', (input, expected) => {
      expect(glueDamageUnits(input)).toEqual(expected)
    })

    it.each([
      [`Атака наносит d6 урона`, `Атака наносит d6&nbsp;урона`],
      [`Бросок: d6! урона и 2d4 урона`, `Бросок: d6!&nbsp;урона и 2d4&nbsp;урона`],
      [`Потеря: 1 урона, потом 5 урона`, `Потеря: 1&nbsp;урона, потом 5&nbsp;урона`],
      [`Сначала 3d6 урону, затем 2 урон`, `Сначала 3d6&nbsp;урону, затем 2&nbsp;урон`],
      [`Эффект длится d6 ходов, иногда d3 хода`, `Эффект длится d6&nbsp;ходов, иногда d3&nbsp;хода`],
      [`Сначала d6 (5) урона, потом 2 хода отдыха`, `Сначала d6 (5)&nbsp;урона, потом 2&nbsp;хода отдыха`],
      [`2d4 (3) ходов и d8! (10) хода`, `2d4 (3)&nbsp;ходов и d8! (10)&nbsp;хода`],
    ])('should replace all matches for %s', (input, expected) => {
      expect(glueDamageUnits(input)).toEqual(expected)
    })

    it.each([
      [`урона без числа`, `урона без числа`],
      [`ходов без числа`, `ходов без числа`],
      [`damage d6`, `damage d6`],
      [`xd6 урона`, `xd6 урона`],
      [`xd6 ходов`, `xd6 ходов`],
      [`ad3 хода`, `ad3 хода`],
      [`foo2d4 урона`, `foo2d4 урона`],
      [`foo2d4 ходов`, `foo2d4 ходов`],
      [`2к6 урона`, `2к6 урона`],
      [`2к6 ходов`, `2к6 ходов`],
      [`урон 5`, `урон 5`],
      [`ход 3`, `ход 3`],
    ])('should not replace invalid patterns for %s', (input, expected) => {
      expect(glueDamageUnits(input)).toEqual(expected)
    })
  })

  describe('glueShorthands', () => {
    it.each([
      [`т. п.`, `<nobr>т. п.</nobr>`],
      [`т.п.`, `<nobr>т.п.</nobr>`],
      [`т. д.`, `<nobr>т. д.</nobr>`],
      [`т.д.`, `<nobr>т.д.</nobr>`],
      [`т. е.`, `<nobr>т. е.</nobr>`],
      [`т.е.`, `<nobr>т.е.</nobr>`],
      [`т. к.`, `<nobr>т. к.</nobr>`],
      [`т.к.`, `<nobr>т.к.</nobr>`],
      [`т. н.`, `<nobr>т. н.</nobr>`],
      [`т.н.`, `<nobr>т.н.</nobr>`],
      [`и др.`, `<nobr>и др.</nobr>`],
      [`и пр.`, `<nobr>и пр.</nobr>`],
      [`в т. ч.`, `<nobr>в т. ч.</nobr>`],
      [`в т.ч.`, `<nobr>в т.ч.</nobr>`],
      [`и т. п.`, `<nobr>и т. п.</nobr>`],
      [`и т.п.`, `<nobr>и т.п.</nobr>`],
      [`и т. д.`, `<nobr>и т. д.</nobr>`],
      [`и т.д.`, `<nobr>и т.д.</nobr>`],
      [`Т. П.`, `<nobr>Т. П.</nobr>`],
      [`И Т. Д.`, `<nobr>И Т. Д.</nobr>`],
      [`В Т. Ч.`, `<nobr>В Т. Ч.</nobr>`],
      [`И ДР.`, `<nobr>И ДР.</nobr>`],
    ])('should wrap shorthand in nobr for %s', (input, expected) => {
      expect(glueShorthands(input)).toEqual(expected)
    })

    it.each([
      [`и т. п. варианты`, `<nobr>и т. п.</nobr> варианты`],
      [`список, т. д. продолжается`, `список, <nobr>т. д.</nobr> продолжается`],
      [`это, т. е. частный случай`, `это, <nobr>т. е.</nobr> частный случай`],
      [`т. к. правило нарушено`, `<nobr>т. к.</nobr> правило нарушено`],
      [`т. н. "магический эффект"`, `<nobr>т. н.</nobr> "магический эффект"`],
      [`навыки и др. свойства`, `навыки <nobr>и др.</nobr> свойства`],
      [`оружие и пр. предметы`, `оружие <nobr>и пр.</nobr> предметы`],
      [`эффекты, в т. ч. скрытые`, `эффекты, <nobr>в т. ч.</nobr> скрытые`],
      [`одно т. п. и еще одно т. д.`, `одно <nobr>т. п.</nobr> и еще одно <nobr>т. д.</nobr>`],
      [`и т.д., и т.п., и др.`, `<nobr>и т.д.</nobr>, <nobr>и т.п.</nobr>, <nobr>и др.</nobr>`],
      [`Т. П. и Т. Д.`, '<nobr>Т. П.</nobr> <nobr>и Т. Д.</nobr>'],
      [`Т. П. и т. д.`, `<nobr>Т. П.</nobr> <nobr>и т. д.</nobr>`],
      [`В т.ч. и т.е. тут тоже должны сработать`, `<nobr>В т.ч.</nobr> и <nobr>т.е.</nobr> тут тоже должны сработать`],
      [`Это, в т. ч. и т. п., встречается часто`, `Это, <nobr>в т. ч.</nobr> <nobr>и т. п.</nobr>, встречается часто`],
      [`Список: и др., и пр., и т. д.`, `Список: <nobr>и др.</nobr>, <nobr>и пр.</nobr>, <nobr>и т. д.</nobr>`],
    ])('should replace all shorthands for %s', (input, expected) => {
      expect(glueShorthands(input)).toEqual(expected)
    })

    it.each([
      [`т п`, `т п`],
      [`т.п`, `т.п`],
      [`т.д`, `т.д`],
      [`и др`, `и др`],
      [`и пр`, `и пр`],
      [`в т ч`, `в т ч`],
      [`т.. п.`, `т.. п.`],
      [`тx пy`, `тx пy`],
      [`т, п.`, `т, п.`],
      [`вт.ч.`, `вт.ч.`],
      [`ит.д.`, `ит.д.`],
      [`конт.д.пример`, `конт.д.пример`],
      [`прит.п.`, `прит.п.`],
      [`идр.`, `идр.`],
      [`ипр.`, `ипр.`],
      [`это просто текст`, `это просто текст`],
    ])('should not replace invalid patterns for %s', (input, expected) => {
      expect(glueShorthands(input)).toEqual(expected)
    })
  })
})
