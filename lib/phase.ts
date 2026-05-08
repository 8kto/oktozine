const errToShort = (err: unknown): string => {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    const code = e.code ? ` code=${String(e.code)}` : ''
    const p = e.path ? ` path=${String(e.path)}` : ''
    const sc = e.syscall ? ` syscall=${String(e.syscall)}` : ''
    const msg = e.message ? ` msg=${String(e.message)}` : ` ${String(err)}`

    return `${msg}${code}${sc}${p}`
  }

  return String(err)
}

export const runPhase = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn()
  } catch (err) {
    // Re-throw anchored here, preserving the original error as cause.
    throw new Error(`${label} (${errToShort(err)})`, { cause: err })
  }
}

export const runPhaseSync = <T>(label: string, fn: () => T): T => {
  try {
    return fn()
  } catch (err) {
    throw new Error(`${label} (${errToShort(err)})`, { cause: err })
  }
}
