# Healify Constitution

Constitución del proyecto Healify: reglas de gobierno para todo el desarrollo, aplicables a cada spec, plan y tarea.

## Core Principles

### I. 100% Local
Todo el procesamiento ocurre en la máquina del usuario. Prohibido enviar datos, selectores, tests o historiales a servicios externos. Sin modo nube. Sin telemetría. La integración con Ollama (IA local) es opcional y corre en localhost.

### II. Heurística, no IA
El motor de healing es una heurística con verificación real contra el DOM. Nunca inflar sus capacidades ni presentarlo como IA. La IA local es un complemento opcional, nunca un reemplazo. Todo debe funcionar sin ella.

### III. Determinista
Los fixes generados deben ser reproducibles y explicables (confidence score, causa diagnosticada). Sin comportamiento aleatorio ni generativo en el núcleo. `suggest-only`, `min-confidence` y `validate` son parte del contrato público.

### IV. Multi-Framework (NON-NEGOTIABLE)
Soporte de primera clase para Playwright, Cypress, Selenium y WebdriverIO. Ninguna feature puede romper ni ignorar un framework. Nuevos datos que varíen por framework deben registrarlo (campo explícito), nunca inferirlo.

### V. Calidad: Tests, Cobertura y CI
- Cobertura ≥ 80% en paquetes con lógica de negocio (reporter-core, cli).
- Los tests son obligatorios para features y bugfixes: unit + contract cuando haya contrato.
- Verificación de verdad: probar con el binario/reporte real, no asumir que funciona porque los tests pasan.
- CI/CD debe quedar verde antes de mergear. `npm run verify` debe pasar.
- Lint (eslint) y formato (prettier) limpios.

### VI. Documentación Bilingüe
Toda feature afecta la documentación: README.md (EN) y README.es.md (ES) actualizados, CHANGELOG.md con notas de release, y docs/project-status.md reflejando el estado real.

### VII. Dashboard Funcional y Atractivo
El dashboard es la cara visible del producto: debe mostrar datos reales y útiles, ser responsivo, accesible e interactivo (hover/detalle). Cero datos inventados o de ejemplo en producción.

## Calidad y Estándares de Código

- Stack: TypeScript estricto, Node.js, npm workspaces (monorepo), Vitest.
- El motor vive en `reporter-core` (privado); los adapters por framework exponen solo la API pública estable.
- Backwards-compat: los archivos de datos locales (history.jsonl, runs.jsonl, stats.json) toleran campos ausentes (opcional) — añadir campos nunca es breaking change.
- Sin dependencias nuevas sin justificación en el plan.

## Flujo de Desarrollo y Gates de Calidad

1. Spec-Driven: spec → plan → tasks → implement, con revisión explícita en cada checkpoint.
2. Gate de constitución: ningún plan procede si viola un principio (justificar por escrito en Complexity Tracking si es inevitable).
3. Los comandos de release (npm publish, git push, git tag) los ejecuta el humano, nunca el agente.
4. Actualizar CHANGELOG.md y project-status.md en cada feature completada.

## Governance

- La constitución prevalece sobre cualquier otra práctica o instrucción ad-hoc.
- Enmiendas: proponer por escrito, con justificación y plan de migración.
- Toda PR/review debe verificar cumplimiento con esta constitución.
- La complejidad debe justificarse; los artefactos de plan (spec.md, plan.md, tasks.md) viven en `specs/`.

**Version**: 1.0.0 | **Ratified**: 2026-08-13 | **Last Amended**: 2026-08-13
