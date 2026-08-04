# @healify/ai-local

Un ayudante opcional que le explica en castellano —o en inglés— lo que Healify ya decidió solo.

## Lo primero: esto no cura nada

Healify arregla selectores rotos con heurísticas deterministas. Sin modelos, sin API keys, sin
red. Ese motor **no cambia** al instalar este paquete, y no lo necesita para funcionar.

`@healify/ai-local` hace otra cosa: agarra un `healify-report.json` que ya existe y le pide a un
modelo que corre en tu máquina que lo explique en lenguaje natural. Es una capa de lectura
encima del resultado, no una pieza del camino que produce el resultado.

Por eso viene **apagado por default** (`enabled: false`) y por eso vive en un paquete aparte: si
nunca lo instalás, Healify se comporta exactamente igual.

## Requisito: Ollama

El modelo corre en tu máquina, con [Ollama](https://ollama.com). No hay nube, no hay API key, y
nada de tu código sale de la computadora.

```bash
npm install --save-dev @healify/ai-local
npx healify-ai setup
```

`setup` mira cuánta RAM tenés y te sugiere un modelo que entre:

| Modelo | RAM mínima | Tamaño |
|---|---|---|
| `phi3:mini` | 4 GB | ~2 GB |
| `llama3.2:3b` | 8 GB | ~2 GB |
| `llama3.1:8b` | 16 GB | ~5 GB |
| `llama3.1:13b` | 24 GB | ~8 GB |

Reserva 2 GB para el sistema operativo antes de recomendar, así que en una máquina de 8 GB te va
a proponer `phi3:mini` y no `llama3.2:3b`. Es a propósito: un modelo que swapea tarda más que
leer el reporte a mano.

## CLI

```bash
npx healify-ai status                       # ¿está Ollama corriendo? ¿qué modelos hay?
npx healify-ai models                       # catálogo, con ✅/❌ según tu RAM
npx healify-ai explain "[data-testid=btn]"  # qué busca ese selector y por qué es frágil
npx healify-ai chat                         # conversación sobre el reporte actual
```

Con `@healify/cli` instalado es lo mismo con `healify ai setup`, `healify ai status`, etc.

`status` es el único que contesta con Ollama apagado (para eso está). Los demás avisan y cortan.

## API

```ts
import { HealifyAI } from '@healify/ai-local'

const ai = new HealifyAI({ enabled: true, language: 'es' })
const { success, message } = await ai.init()

if (!success) {
  console.warn(message) // Ollama apagado, o el modelo no está bajado
}
```

`init()` no tira excepción cuando Ollama no responde: devuelve `success: false` con el motivo.
Un ayudante opcional que rompe el pipeline cuando no está disponible deja de ser opcional.

Detección por separado, si querés decidir vos:

```ts
import { getSystemRAM, suggestModel, checkOllamaRunning } from '@healify/ai-local/detect'
```

## ¿Hace falta instalarlo aparte?

Casi nunca. Si ya tenés `@healify/cli`, este código viaja adentro (queda bundleado en el build
del CLI) y lo usás con `healify ai …` sin instalar nada más.

Este paquete existe suelto para el otro caso: importarlo como librería desde tu propio script,
sin pasar por el CLI.

En cualquiera de los dos, **Ollama** sí es un requisito aparte, y sin él estos comandos avisan y
no hacen nada. El resto de Healify sigue funcionando igual.

## Lo que no hace

- **No decide curaciones.** El `fixedSelector` de un reporte sale de las heurísticas de
  `@healify/reporter-core`, que no consulta ningún modelo. Este paquete lee reportes ya
  escritos; no participa en escribirlos.
- **No manda nada a internet.** Habla con `localhost:11434` y con nada más.

Si lo que querés es que los tests dejen de romperse por selectores, no necesitás nada de esto:
[`@healify/cli`](https://www.npmjs.com/package/@healify/cli) y listo.

## Licencia

MIT — parte de [Healify](https://github.com/mescobar996/Healify).
