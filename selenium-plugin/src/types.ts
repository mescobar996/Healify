/** Piso de confianza por default — igual al umbral HEALED_THRESHOLD (auto-aplicado sin revisión) de reporter-core/src/local-mode.ts, no al de "a revisar" (0.8): acá no hay paso de revisión humana, así que el piso para actuar solo debe ser el más alto que el motor ya define. */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.9

export interface HealifySeleniumOptions {
  /** Confianza mínima (0-1) de analyzeAndHeal() para probar la sugerencia. Default: 0.9. */
  confidenceThreshold?: number
  /** Si es true, cura pero nunca aplica el fix — solo emite el evento 'healed' con dryRun implícito y lanza el error original. Default: false. */
  dryRun?: boolean
  /** Hook opcional para observar cada intento de curado (logging, tests del usuario). */
  onEvent?: (event: HealingEvent) => void
}

export type HealingEventType =
  | 'healed'
  | 'no-suggestion'
  | 'not-convertible'
  | 'failed'
  | 'error'

export interface HealingEvent {
  type: HealingEventType
  originalSelector: string
  fixedSelector?: string
  confidence?: number
  explanation?: string
  latencyMs: number
}
