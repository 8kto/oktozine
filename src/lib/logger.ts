import pino from 'pino'

export const logger = pino({
  level: process.env.PINO_LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: false,
      ignore: 'level,pid,hostname',
      messageFormat: '',
    },
  },
})

export const setLogLevel = (level: string): void => {
  logger.level = level
}
