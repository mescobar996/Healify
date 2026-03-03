/**
 * Sentry — Server-side (Node.js) configuration
 *
 * Captures unhandled exceptions and errors in API routes, server components,
 * server actions, and middleware running on the Node.js runtime.
 */

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Spotlight shows Sentry events in the browser in dev
  spotlight: process.env.NODE_ENV === 'development',

  beforeSend(event) {
    // Redact sensitive fields
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>
      for (const key of ['password', 'token', 'secret', 'apiKey', 'authorization']) {
        if (key in data) data[key] = '[Filtered]'
      }
    }
    return event
  },
})
