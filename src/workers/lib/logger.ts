/** Structured job logger — prefixes every line with [Job <id>]. */

export function log(jobId: string, message: string): void {
  console.log(`[Job ${jobId}] ${message}`)
}

export function logError(jobId: string, message: string, error?: Error | unknown): void {
  const errorMsg = error instanceof Error ? error.message : String(error)
  console.error(`[Job ${jobId}] ERROR: ${message}`, errorMsg)
}
