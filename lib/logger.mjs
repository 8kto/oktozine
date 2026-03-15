import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: false, // “INFO” goes before the message
      ignore: 'level,pid,hostname', // drop timestamp, pid and hostname
      messageFormat: '',
    },
  },
})
