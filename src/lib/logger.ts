// Simple logger utility for Healify
// Provides consistent logging interface across the application

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogContext {
  [key: string]: unknown
}

class Logger {
  private formatMessage(level: LogLevel, context: string, message: string, meta?: LogContext): string {
    const timestamp = new Date().toISOString()
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}${metaStr}`
  }

  info(context: string, message: string, meta?: LogContext): void {
    if (process.env.NODE_ENV === 'production') return
    console.log(this.formatMessage('info', context, message, meta))
  }

  warn(context: string, message: string, meta?: LogContext): void {
    console.warn(this.formatMessage('warn', context, message, meta))
  }

  error(context: string, message: string, meta?: LogContext): void {
    console.error(this.formatMessage('error', context, message, meta))
  }

  debug(context: string, message: string, meta?: LogContext): void {
    if (process.env.NODE_ENV === 'production') return
    console.debug(this.formatMessage('debug', context, message, meta))
  }
}

export const logger = new Logger()
