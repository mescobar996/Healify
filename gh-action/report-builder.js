/**
 * Arma el `LocalRun` (el JSON que consume `healify fix`) desde los selectores extraídos del
 * log y las respuestas de `healify heal` para cada uno.
 *
 * `healify heal` es el motor expuesto como subproceso JSON (el mismo que corre el CLI en
 * `commands/heal.ts`); este módulo traduce su salida al shape `LocalCaseResult` que ya
 * conoce `fix`. El mapeo de estados replica el de `reporter-core/src/local-mode.ts`:
 *   healed      → confidence >= 0.90  (único estado que `fix` aplica de verdad)
 *   review      → confidence >= 0.80
 *   unresolved  → el resto, o heal que falló
 */

/** Criterio de estados, alineado con resolveThresholds default del motor (0.90 / 0.80). */
export function statusForConfidence(confidence, healFailed) {
  if (healFailed || !Number.isFinite(confidence) || confidence <= 0) return 'unresolved'
  if (confidence >= 0.9) return 'healed'
  if (confidence >= 0.8) return 'review'
  return 'unresolved'
}

/** ID estable del defecto — mismo formato que `buildDefectId` en reporter-core: hash del
 * `testFile::selector`, para que el mismo selector roto derive siempre el mismo ID. */
export function defectIdFor(testFile, selector) {
  const key = `${testFile ?? ''}::${selector}`
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Primera línea del error, que es la que describe qué pasó — mismo criterio que el reporte. */
function firstLine(text) {
  return String(text ?? '').split('\n')[0].trim()
}

/**
 * Convierte las salidas de heal en casos del reporte. `healResults` debe tener la misma
 * longitud y el mismo orden que `cases`: cada entrada es `{ ok, output }` — `output` con el
 * shape de `HealCommandOutput` cuando ok, o `{ error }` cuando no.
 */
export function buildRunFromHealResults(cases, healResults, options) {
  const { project, framework } = options

  const reportCases = cases.map((c, i) => {
    const heal = healResults[i]
    const failed = !heal || !heal.ok
    const output = failed ? {} : heal.output
    const confidence = failed ? 0 : output.confidence
    const fixedSelector = failed ? '' : output.fixedSelector ?? ''
    const status = statusForConfidence(confidence, failed)

    return {
      testName: c.testName ?? c.selector,
      testFile: c.testFile,
      selector: c.selector,
      errorMessage: c.errorMessage ?? '',
      status,
      fixedSelector,
      confidence,
      explanation: failed ? (heal?.error ?? 'El motor no pudo analizar este selector.') : output.explanation ?? '',
      selectorType: failed ? 'UNKNOWN' : output.selectorType ?? 'UNKNOWN',
      verified: failed ? false : output.verified ?? false,
      fromRepertoire: failed ? false : output.fromRepertoire ?? false,
      cause: 'selector',
      defectId: defectIdFor(c.testFile, c.selector),
      severity: status === 'healed' ? 'minor' : status === 'review' ? 'major' : 'blocker',
      expected: `El selector ${c.selector} encuentra un elemento en la página.`,
      actual: firstLine(c.errorMessage),
    }
  })

  const healedCount = reportCases.filter((c) => c.status === 'healed').length
  const reviewCount = reportCases.filter((c) => c.status === 'review').length
  const unresolvedCount = reportCases.filter((c) => c.status === 'unresolved').length

  return {
    project,
    framework,
    generatedAt: new Date().toISOString(),
    verdict: reportCases.length > 0 && unresolvedCount === 0 && reviewCount === 0 ? 'passed' : 'failed',
    cases: reportCases,
    stats: {
      total: reportCases.length,
      passed: healedCount,
      healed: healedCount,
      failed: reportCases.length - healedCount,
      review: reviewCount,
      unresolved: unresolvedCount,
    },
  }
}
