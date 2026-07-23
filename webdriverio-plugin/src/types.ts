export const DEFAULT_CONFIDENCE_THRESHOLD = 0.9

export interface HealifyWebdriverIOOptions {
  /** Confianza mínima (0-1) de analyzeAndHeal() para probar la sugerencia. Default: 0.9. */
  confidenceThreshold?: number
  /** Si es true, cura pero nunca aplica el fix — solo emite el evento 'healed' y lanza el error original. Default: false. */
  dryRun?: boolean
  /** Hook opcional para observar cada intento de curado (logging, tests del usuario). */
  onEvent?: (event: HealingEvent) => void
  /** Nombre del proyecto para el reporte. Default: 'webdriverio-project'. */
  projectName?: string
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
