# Healify Cypress Plugin

## Instalación

```bash
npm install @healify/cypress-plugin --save-dev
```

Requiere `cypress >= 13.0.0` como dependencia peer.

## Configuración

### 1. Registrar el plugin

En tu `cypress.config.ts`:

```typescript
import { defineConfig } from 'cypress'
import { HealifyCypressPlugin } from '@healify/cypress-plugin'

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      return HealifyCypressPlugin(on, config)
    },
  },
})
```

### 2. Importar soporte (opcional, para curación en vivo)

En tu `cypress/support/e2e.ts`:

```typescript
import '@healify/cypress-plugin/support'
```

Esto importa el código de soporte del lado del navegador que:
- Registra un handler global `Cypress.on('fail')` para registro de auditoría.
- Agrega el comando `cy.healifyGet()` para curación en vivo de selectores.

## Uso

### Generación automática de reportes

Una vez configurado, Healify intercepta automáticamente los tests fallidos y genera un reporte al finalizar la ejecución de Cypress:

- `healify-report.html` — reporte HTML interactivo (dark/light, offline)
- `healify-report.json` — reporte JSON legible por máquina
- `healify-report.md` — resumen en markdown

Si algún selector falló y fue curado vía `cy.healifyGet()`, también se escribe un registro de auditoría:

- `healify-audit.json` — registro detallado de eventos de curación

### Curación en vivo con `cy.healifyGet`

Después de importar el código de soporte, podés usar `cy.healifyGet()` para intentar curar selectores en tiempo real contra el DOM vivo:

```typescript
// En lugar de:
cy.get('#comprar-ahora-a1b2c3').click()

// Usá:
cy.healifyGet('#comprar-ahora-a1b2c3').click()
```

Si el selector no se encuentra dentro del timeout, Healify:
1. Sondea el DOM actual de la página
2. Ejecuta su heurística para encontrar una alternativa funcional
3. Reintenta con el selector sugerido antes de fallar el test

**Opciones:**

```typescript
cy.healifyGet(selector, {
  timeout: 4000,                    // ms a esperar (default: Cypress defaultCommandTimeout)
  confidenceThreshold: 0.9         // confianza mínima para aplicar un fix (default: 0.9)
})
```

### Registro de auditoría

Healify genera automáticamente un registro de auditoría (`healify-audit.json`) cuando los selectores fallan o son curados. Ejemplo:

```json
{
  "entries": [
    {
      "id": "...",
      "timestamp": "...",
      "originalSelector": "#comprar-ahora-a1b2c3",
      "healedSelector": "button[data-testid='buy-now']",
      "framework": "cypress",
      "confidence": 0.95,
      "verified": true
    }
  ]
}
```

## Referencia de la API

### `HealifyCypressPlugin(on, config)`

Registra el plugin de Healify en el proceso Node de Cypress.

**Parámetros:**
- `on` — handler de eventos del plugin de Cypress
- `config` — objeto de configuración de Cypress

**Retorna:** El mismo objeto `config`, sin modificar.

**Qué hace:**
- Registra tareas: `healify:probe-script`, `healify:heal`, `healify:record-event`, `healify:audit-entry`
- Escucha `after:spec` para ejecutar la curación local en tests fallidos
- Escucha `after:run` para escribir reportes e imprimir un resumen

### `@healify/cypress-plugin/support`

Importa el código de soporte del lado del navegador que:
- Registra el comando `cy.healifyGet()`
- Registra un handler global de `fail` para registro de auditoría

### `cy.healifyGet(selector, options?)`

Comando personalizado de Cypress que intenta encontrar un selector, y si falla, sondea el DOM y reintenta con una alternativa curada.

**Parámetros:**
- `selector` (string) — selector CSS o XPath a buscar
- `options` (opcional):
  - `timeout` (number) — milisegundos a esperar por el selector (default: Cypress defaultCommandTimeout)
  - `confidenceThreshold` (number) — confianza mínima 0-1 para aceptar un selector curado (default: 0.9)

**Retorna:** `Chainable<JQuery<HTMLElement>>`

## Integración con CLI

Después de generar un reporte, podés aplicar fixes automáticamente:

```bash
npx @healify/cli fix --dry-run      # vista previa de cambios
npx @healify/cli fix                 # aplica fixes de alta confianza
npx @healify/cli fix --interactive   # elegís qué fixes aplicar
```

## Solución de problemas

### El plugin no funciona

1. Verificá que hayas agregado tanto la configuración (`HealifyCypressPlugin`) como las importaciones de soporte.
2. Revisá que `@healify/reporter-core` esté instalado (es dependencia del plugin).
3. Verificá que tus selectores usen sintaxis CSS/XPath estándar.

### No se genera el registro de auditoría

El registro de auditoría (`healify-audit.json`) solo se crea cuando los selectores fallan o son curados vía `cy.healifyGet()`. Si todos los tests pasan con selectores válidos, no se crea ningún registro.

### Los reportes no aparecen

Los reportes se escriben en el directorio de trabajo actual cuando Cypress termina de ejecutase. Asegurate de ejecutar Cypress desde la raíz del proyecto donde esperás que se generen los archivos.

### `cy.healifyGet` no se encuentra

Verificá que hayas importado el archivo de soporte en `cypress/support/e2e.ts`:

```typescript
import '@healify/cypress-plugin/support'
```

## Cómo funciona

1. **Curación local (siempre activa):** Cuando un test falla, el hook `after:spec` de Cypress activa la heurística de Healify sobre el test fallido. Hace pattern matching en el texto del selector y mensajes de error sin acceso a red.

2. **Curación en vivo (opcional vía `cy.healifyGet`):** Cuando un selector no se encuentra, el comando sondea el DOM real, envía los elementos de la página al proceso Node vía `cy.task()`, recibe un selector curado y reintenta.

3. **Registro de auditoría:** Cada evento de curación se registra en `healify-audit.json` con timestamps, selectores originales/curados, puntuaciones de confianza y estado de verificación.

## Ejemplo

```typescript
// cypress/e2e/checkout.cy.ts
describe('Checkout', () => {
  it('adds item to cart', () => {
    // Si este selector se rompe, Healify intentará arreglarlo
    cy.healifyGet('#add-to-cart-btn').click()
    cy.healifyGet('.checkout-form').should('be.visible')
    cy.healifyGet('button[type="submit"]').click()
  })
})
```

Ejecutar `npx cypress run` generará un reporte con cualquier sugerencia de curación.
