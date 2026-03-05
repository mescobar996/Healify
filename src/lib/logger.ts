/**
 * Logger estructurado para Healify.
 *
 * En producción (Vercel) usa console.log con JSON estructurado — compatible
 * con los log drains de Vercel y la mayoría de plataformas (Datadog, Logtail, etc).
 * En desarrollo imprime texto legible con colores.
 *
 * Uso:
 *   import { logger } from '@/lib/logger'
 *   logger.info('[Webhook]', 'Job enqueued', { jobId, testRunId })
 *   logger.warn('[HealingService]', 'Fallback activado', { reason })
 *   logger.error('[Auth]', 'Email failed', { error: err.message })
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level:     LogLevel
  ns:        string   // namespace, e.g. "[Webhook]"
  msg:       string
  meta?:     Record<string, unknown>
  ts:        string
  env:       string
}

const IS_PROD = process.env.NODE_ENV === 'production'
const IS_TEST = process.env.NODE_ENV === 'test'

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',  // gray
  info:  '\x1b[36m',  // cyan
  warn:  '\x1b[33m',  // yellow
  error: '\x1b[31m',  // red
}
const RESET = '\x1b[0m'

function log(level: LogLevel, ns: string, msg: string, meta?: Record<string, unknown>) {
  if (IS_TEST) return  // silenciar en tests

  const entry: LogEntry = {
    level,
    ns,
    msg,
    meta,
    ts:  new Date().toISOString(),
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
  }

  if (IS_PROD) {
    // JSON estructurado — ideal para log aggregators
    const fn = level === 'error' ? console.error
             : level === 'warn'  ? console.warn
             : console.log
    fn(JSON.stringify(entry))
  } else {
    // Dev: legible con colores
    const color = COLORS[level]
    const metaStr = meta ? ' ' + JSON.stringify(meta) : ''
    const fn = level === 'error' ? console.error
             : level === 'warn'  ? console.warn
             : console.log
    fn(`${color}[${level.toUpperCase()}]${RESET} ${ns} ${msg}${metaStr}`)
  }
}

export const logger = {
  debug: (ns: string, msg: string, meta?: Record<string, unknown>) => log('debug', ns, msg, meta),
  info:  (ns: string, msg: string, meta?: Record<string, unknown>) => log('info',  ns, msg, meta),
  warn:  (ns: string, msg: string, meta?: Record<string, unknown>) => log('warn',  ns, msg, meta),
  error: (ns: string, msg: string, meta?: Record<string, unknown>) => log('error', ns, msg, meta),
}
