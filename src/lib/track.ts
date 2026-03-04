/**
 * Lightweight client-side analytics tracker.
 * Fire-and-forget — never blocks the UI.
 */
export function trackEvent(event: string, metadata?: Record<string, unknown>) {
  if (typeof window === "undefined") return

  // Use sendBeacon for reliability on page unloads; fall back to fetch
  const payload = JSON.stringify({ event, metadata: metadata ?? {} })

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" })
    navigator.sendBeacon("/api/analytics/events", blob)
  } else {
    void fetch("/api/analytics/events", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  }
}
