import type { ITocOverrides } from '../scripts/oktozine/types'

const mainTocConf: ITocOverrides = {
  dropLabels: ['Зеница Варготара', 'Содержание'],
  dropItemsFromLabels: [
    'Приложение. Микомант',
    'Благодарности и техническая информация',
    'О модуле и как его водить',
    'Окружение и обитатели',
  ],
  alwaysInclude: ['Верёвочная лестница', 'Кристаллы', 'Грибы', 'Заклинания Микоманта'],
}

export const tocOverrides: ITocOverrides = {
  dropLabels: ['Содержание'],
  parts: {
    main: mainTocConf,
    osr: mainTocConf,
  },
}
