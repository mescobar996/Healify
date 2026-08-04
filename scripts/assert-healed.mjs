#!/usr/bin/env node
/**
 * Verifica que un healify-report.json registre una curación REAL del selector indicado.
 *
 * Existe porque los ejemplos de cura en vivo (Cypress, Selenium) no tienen etapa de "fix": el
 * test pasa o no pasa, y un test verde no prueba nada por sí solo. Si mañana alguien arregla el
 * HTML del demo y el selector roto vuelve a existir, el test sigue en verde mientras Healify no
 * hace absolutamente nada — el ejemplo pasa a mentir sin que nadie se entere.
 *
 * No alcanza con buscar la palabra "healed" en el JSON: el bloque `stats` la tiene siempre como
 * clave, valga 0 o 20. Hay que mirar el caso.
 *
 *   node scripts/assert-healed.mjs healify-report.json '#pay-btn-a1b2c3'
 */
import { readFileSync } from 'node:fs'

const [reportPath, expectedSelector] = process.argv.slice(2)

if (!reportPath || !expectedSelector) {
  console.error('uso: assert-healed.mjs <healify-report.json> <selector-roto>')
  process.exit(2)
}

/** `::error::` hace que GitHub lo muestre como anotación en el diff, no enterrado en el log. */
function fail(message) {
  console.error(`::error::${message}`)
  process.exit(1)
}

let report
try {
  report = JSON.parse(readFileSync(reportPath, 'utf-8'))
} catch (error) {
  fail(`No se pudo leer ${reportPath}: ${error.message}. El adapter no llegó a escribir el reporte.`)
}

const cases = Array.isArray(report.cases) ? report.cases : []
const target = cases.find((c) => c.selector === expectedSelector)

if (!target) {
  fail(
    `El reporte no menciona el selector roto "${expectedSelector}". ` +
      `Selectores encontrados: ${cases.map((c) => c.selector).join(', ') || '(ninguno)'}. ` +
      `O el ejemplo cambió sin actualizar esta verificación, o el adapter nunca vio el fallo.`
  )
}

if (target.status !== 'healed') {
  fail(`"${expectedSelector}" quedó en status "${target.status}", no "healed".`)
}

// `verified: true` significa que la sugerencia se confrontó contra el DOM real de esa corrida,
// no que la heurística la dedujo del texto del selector. Es la diferencia entre "encontré el
// elemento" y "adiviné un nombre plausible", y es justo lo que estos ejemplos demuestran.
if (target.verified !== true) {
  fail(`"${expectedSelector}" se curó sin verificar contra el DOM (verified: ${target.verified}).`)
}

console.log(`curación verificada ✓  ${expectedSelector} → ${target.fixedSelector}`)
