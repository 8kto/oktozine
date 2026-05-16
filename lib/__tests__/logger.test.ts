import { logger, setLogLevel } from '../logger'

describe('setLogLevel', () => {
  const originalLevel = logger.level

  afterEach(() => {
    logger.level = originalLevel
  })

  it('changes the logger level', () => {
    setLogLevel('debug')
    expect(logger.level).toBe('debug')
  })

  it('does not mutate process.env.LOG_LEVEL', () => {
    const before = process.env.LOG_LEVEL
    setLogLevel('warn')
    expect(process.env.LOG_LEVEL).toBe(before)
  })
})
