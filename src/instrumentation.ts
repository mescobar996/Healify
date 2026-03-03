/**
 * Next.js Instrumentation Hook
 *
 * Bootstraps Sentry for both Node.js and Edge runtimes.
 * This file is loaded once per deployment (or cold-start) by Next.js.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}
