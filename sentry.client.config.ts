/**
 * Sentry — Client-side configuration
 *
 * Captures unhandled errors, promise rejections, and React component errors
 * that occur in the browser.
 *
 * DSN must be set as NEXT_PUBLIC_SENTRY_DSN in Vercel environment variables.
 */

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Disable Sentry entirely if no DSN is configured (e.g. local dev without .env)
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // Transactions / performance (0.1 = 10% sample rate in production)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replays — capture 10% of all sessions, 100% with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all input content and block media to protect user privacy
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Ignore common noise that doesn't need alerts
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    /^NetworkError/,
    /^ChunkLoadError/,
    /Loading chunk .* failed/,
  ],

  beforeSend(event) {
    // Strip password/token values from breadcrumb data
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>
      for (const key of ['password', 'token', 'secret', 'apiKey']) {
        if (key in data) data[key] = '[Filtered]'
      }
    }
    return event
  },
})
