import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Absolute path to the repository root (the directory that contains package.json,
// src/, scripts/, etc.). Resolved once from this file's known location.
//
// When this pipeline is extracted as a standalone library, callers should supply
// the project root via config rather than relying on this module-level constant.
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

export const OKTOZINE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
