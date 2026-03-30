// Module declarations for packages without bundled TypeScript types.

declare module 'hypher' {
  interface HypherLanguage {
    patterns: string[]
    leftmin?: number
    rightmin?: number
    [key: string]: unknown
  }
  export default class Hypher {
    constructor(language: HypherLanguage)
    hyphenate(word: string): string[]
  }
}

declare module 'hyphenation.ru' {
  const patterns: { patterns: string[]; leftmin?: number; rightmin?: number; [key: string]: unknown }
  export default patterns
}

declare module 'markdown-it-ins' {
  import type { PluginSimple } from 'markdown-it'
  const plugin: PluginSimple
  export default plugin
}

declare module 'hyphenopoly' {
  interface HyphenopolyConfig {
    require: string[]
    defaultLanguage?: string
    hyphen?: string
    loader?: (file: string) => Promise<Buffer>
    exceptions?: Record<string, string>
  }
  export function config(options: HyphenopolyConfig): Promise<(text: string) => string>
}

declare module '@pdf-lib/fontkit' {
  const fontkit: import('pdf-lib').Fontkit
  export default fontkit
}
