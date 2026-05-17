export const measure = (label?: string): (() => string) => {
  const start = performance.now()

  return () => {
    const ms = performance.now() - start
    const seconds = (ms / 1000).toFixed(1)
    const res = `${seconds} s (${ms} ms)`

    return label ? `${label}: ${res}` : res
  }
}
