[← Volver a Healify](../README.es.md) · [English](README.md)

---

# Documentación

Todo lo que necesitás para usar Healify en serio. Si venís de cero, empezá por
[Instalación](installation.es.md) — son dos minutos.

## Empezar

| | |
|---|---|
| **[Instalación](installation.es.md)** | Enchufarlo a Playwright, Cypress, Selenium o WebdriverIO. Es un snippet por runner. |
| **[Comandos](cli.es.md)** | `doctor`, `fix`, `dashboard`, `flake`, `watch` y el resto del CLI. |

## Cuando lo quieras afinar

| | |
|---|---|
| **[Configuración](configuration.es.md)** | Umbrales de confianza, apagar el sanado, test-ids propios. Opcional: anda sin nada de esto. |
| **[Reportes y dashboard](reports.es.md)** | El HTML que le pasás al equipo, el histórico y la detección de tests flaky. |

## Integraciones

| | |
|---|---|
| **[Extensión de VS Code](../vscode-extension/)** | Subraya los selectores frágiles mientras escribís; los que se rompieron de verdad traen fix verificado con `Ctrl+.`. |
| **[GitHub Action](github-action.es.md)** | Que comente los selectores rotos en cada PR. Nunca toca archivos. |
| **[Reporte a Jira / webhook](jira.es.md)** | Los defectos entran a tu backlog con evidencia. Opt-in, apagado por default. |

## Ejemplos que se corren

No son snippets: son proyectos completos, verificados en CI contra un browser real.

| | |
|---|---|
| **[Playwright + Page Object Model](../examples/playwright-pom/)** | El selector vive en `pages/`, no en el test. Healify lo encuentra igual. |
| **[Cypress + Shadow DOM](../examples/cypress-shadow-dom/)** | El botón está dentro de un web component, donde `querySelector` devuelve cero. |
| **[Selenium + cura en vivo](../examples/selenium-live-heal/)** | `plugin.wrap(driver)` y nada más. El test no se toca. |

## Para entender el porqué

| | |
|---|---|
| **[Análisis competitivo](research/competitive-gaps.md)** | Los 15 proyectos del rubro que se investigaron antes de escribir una línea, y qué le faltaba a Healify frente a cada uno. |
| **[Adapters](adapters/README.md)** | Usar el motor desde Python, Java, C# o lo que tengas, vía JSON por stdin/stdout. |
| **[IA local opcional](ai/README.md)** | `healify ai` con Ollama. Opcional y también 100% local. |

---

¿Falta algo o algo no se entiende? [Abrí un issue](https://github.com/mescobar996/Healify/issues) —
la documentación que nadie entiende es un bug.
