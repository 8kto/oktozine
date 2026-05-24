import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/build-html.ts', 'src/build-pdf.ts', 'src/types.ts'],
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    clean: true,
    tsconfig: 'tsconfig.build.json',
  },
  {
    entry: ['src/build-module.ts'],
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    banner: { js: '#!/usr/bin/env node' },
    tsconfig: 'tsconfig.build.json',
  },
  {
    entry: ['src/server-daemon.ts'],
    format: ['esm'],
    dts: false,
    outDir: 'dist',
    tsconfig: 'tsconfig.build.json',
  },
])
