# Healify AI - IA Local para Testing

Guía completa de la integración de IA local en Healify usando Ollama.

## ¿Qué es?

Healify AI es un módulo opcional que agrega inteligencia artificial local a Healify:

- **Explicaciones en lenguaje natural** - "Tu selector falló porque..."
- **Sugerencias contextuales** - Entiende la lógica del test
- **Idioma configurable** - Español o inglés
- **100% local** - Sin API keys, sin costo, sin salir de tu máquina

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    Docker (opcional)                    │
│  ┌─────────────┐  ┌─────────────┐                      │
│  │   Ollama    │  │ Open WebUI  │                      │
│  │  (motor IA) │  │ (interfaz)  │                      │
│  └──────┬──────┘  └─────────────┘                      │
└─────────┼───────────────────────────────────────────────┘
          │ API local (localhost:11434)
┌─────────▼───────────────────────────────────────────────┐
│              @healify/ai-local (npm)                    │
│  • Detecta Ollama corriendo                             │
│  • Detecta RAM → sugiere modelo                         │
│  • Envía contexto de healify-report.json                │
│  • Recibe sugerencias enriquecidas                      │
└─────────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────┐
│              Healify actual (sin cambios)                │
│  reporter-core + test-runner + cypress-plugin + ...     │
└─────────────────────────────────────────────────────────┘
```

## Requisitos

- Node.js 18+
- Docker Desktop (para Ollama + Open WebUI)
- 8GB+ RAM recomendado

## Instalación Rápida

### 1. Levantar Ollama + Open WebUI

```bash
cd docker
docker-compose up -d
```

Esto levanta:
- **Ollama** en `http://localhost:11434`
- **Open WebUI** en `http://localhost:3000`

### 2. Configurar Healify AI

```bash
npx @healify/cli ai setup
```

Esto:
- Detecta si Ollama está corriendo
- Detecta tu RAM y sugiere el mejor modelo
- Guarda la configuración en `healify.config.json`

### 3. Descargar un modelo

```bash
# Opción 1: Via terminal
docker exec -it healify-ollama ollama pull llama3.2:3b

# Opción 2: Via Open WebUI
# Abrir http://localhost:3000 → Models → Pull
```

### 4. ¡Listo!

```bash
npx @healify/cli ai explain "[data-testid='btn']"
npx @healify/cli ai chat
```

`healify fix` (el motor heurístico) sigue siendo independiente de la IA — no
la usa ni la necesita. Los comandos `ai *` son la única superficie de IA hoy.

## Modelos Recomendados

| RAM Disponible | Modelo | Tamaño | Velocidad | Calidad |
|----------------|--------|--------|-----------|---------|
| 4-6GB | `phi3:mini` | ~2GB | Rápido | Básica |
| 8-12GB | `llama3.2:3b` | ~2GB | Balanceado | Buena |
| 16GB+ | `llama3.1:8b` | ~5GB | Normal | Excelente |
| 24GB+ | `llama3.1:13b` | ~8GB | Lento | Máxima |

**Recomendación:** Para la mayoría de usuarios, `llama3.2:3b` es el mejor balance.

## Comandos CLI

### `healify ai setup`
Configura la IA local. Detecta Ollama, sugiere modelo, guarda configuración.

```bash
npx @healify/cli ai setup
```

Salida típica:
```
🔧 Healify AI Setup

✅ Ollama detectado en http://localhost:11434

💾 RAM del sistema: 16GB

🤖 Modelo sugerido: llama3.1:8b
   Tamaño: ~5GB
   Descripción: Alta calidad, mejor para tareas complejas

📦 Modelos instalados:
   - llama3.2:3b

✅ Configuración guardada en healify.config.json
```

### `healify ai status`
Muestra el estado actual de Ollama y la configuración.

```bash
npx @healify/cli ai status
```

### `healify ai explain <selector>`
Explica con IA por qué un selector es frágil.

```bash
npx @healify/cli ai explain "[data-testid='submit-btn']"
```

Salida:
```
🔍 Analizando: [data-testid='submit-btn']

**Clasificación:** TESTID (estable)

**Confianza:** 95%

**Por qué es frágil:**
El atributo `data-testid` es estable por convención, pero el valor 
`submit-btn` puede cambiar si se renombra el botón.

**Selector mejorado:**
```javascript
page.getByRole('button', { name: 'Enviar' })
```

**Por qué es mejor:**
- Usa role + name, que es lo que Playwright recomienda
- No depende de atributos de testing
- Más resistente a cambios de implementación
```

### `healify ai chat`
Chat interactivo con IA sobre tests.

```bash
npx @healify/cli ai chat
```

```
💬 Chat con Healify AI (escribe "salir" para terminar)

Tú: ¿Por qué falla mi test de login?

IA: Tu selector `[data-testid='login-btn']` ya no existe en el DOM.
El botón de login ahora tiene:
- `role='button'`
- `aria-label='Iniciar sesión'`

Fix sugerido:
```javascript
page.getByRole('button', { name: 'Iniciar sesión' })
```

Tú: ¿Cómo puedo hacer mis tests más estables?

IA: Recomendaciones:
1. Usa `getByRole` en vez de selectores CSS
2. Evita `data-testid` cuando sea posible
3. Prioriza selectores basados en texto visible
4. Usa `getByLabel` para campos de formulario
```

### `healify ai models`
Lista modelos disponibles y recomendados.

```bash
npx @healify/cli ai models
```

## Configuración

Crea `healify.config.json` en la raíz de tu proyecto:

```json
{
  "ai": {
    "enabled": true,
    "model": "llama3.2:3b",
    "language": "es",
    "autoFix": false,
    "explainSeverity": "all",
    "ollamaUrl": "http://localhost:11434"
  }
}
```

### Opciones

| Opción | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Habilitar IA |
| `model` | string | `llama3.2:3b` | Modelo de Ollama a usar |
| `language` | string | `es` | Idioma de respuestas (`es` o `en`) |
| `autoFix` | boolean | `false` | Aplicar fixes automáticamente con IA |
| `explainSeverity` | string | `all` | Severidad de explicaciones (`all`, `high`, `critical`) |
| `ollamaUrl` | string | `http://localhost:11434` | URL de Ollama |

## Python (para equipos sin Node.js)

Si tu equipo no usa Node.js, instala el paquete Python:

```bash
pip install healify-ai
```

```bash
# Configurar
healify-ai setup

# Explicar
healify-ai explain "[data-testid='btn']"

# Chat
healify-ai chat
```

Ver [python/healify-ai/README.md](../../python/healify-ai/README.md) para detalles.

## Open WebUI (Interfaz Web)

Una vez que Ollama está corriendo, puedes usar Open WebUI para:

- Chatear con la IA visualmente
- Ver historial de conversaciones
- Cambiar modelos fácilmente
- Subir archivos de contexto

Accede a: `http://localhost:3000`

### Primer uso de Open WebUI

1. Abre `http://localhost:3000`
2. Crea una cuenta (primera vez)
3. Selecciona un modelo
4. ¡Chatea!

## Solución de Problemas

### "Ollama no está corriendo"

```bash
# Verificar contenedor
docker ps | grep healify-ollama

# Reiniciar
cd docker && docker-compose restart ollama

# Ver logs
docker logs healify-ollama
```

### "Modelo no encontrado"

```bash
# Listar modelos instalados
docker exec -it healify-ollama ollama list

# Descargar modelo
docker exec -it healify-ollama ollama pull llama3.2:3b
```

### "RAM insuficiente"

```bash
# Verificar RAM disponible
npx @healify/cli ai models

# Usar modelo más ligero
# Editar healify.config.json:
# "model": "phi3:mini"
```

### "Respuestas lentas"

- Usa un modelo más pequeño (`phi3:mini` o `llama3.2:3b`)
- Cierra otras aplicaciones que consuman RAM
- Verifica que Docker tenga suficientes recursos asignados

### "Error de conexión"

```bash
# Verificar que Ollama responde
curl http://localhost:11434/api/tags

# Si no responde, reiniciar
docker-compose restart ollama
```

## Rendimiento

| Modelo | RAM | Tiempo respuesta | Calidad |
|--------|-----|------------------|---------|
| phi3:mini | ~2GB | ~1-2s | Básica |
| llama3.2:3b | ~2GB | ~2-4s | Buena |
| llama3.1:8b | ~5GB | ~5-10s | Excelente |

**Tip:** Para uso diario, `llama3.2:3b` ofrece el mejor balance velocidad/calidad.

## Seguridad

- **100% local** - Ningún dato sale de tu máquina; nada se manda a un LLM en la nube
- **Sin API keys** - No necesitas cuentas externas
- **Sin tracking** - No se envía información a terceros
- **Código abierto** - Puedes revisar todo el código
- **Puertos en loopback** - `docker-compose.yml` publica Ollama (11434) y Open
  WebUI (3000) solo en `127.0.0.1`, no en toda la red — Ollama no tiene
  autenticación propia, así que exponerlo a la LAN dejaría su API abierta a
  cualquiera en la misma red. Open WebUI requiere login (cuenta creada en el
  primer acceso).

## Próximos Pasos

- [ ] Soporte para más modelos (Mistral, CodeLlama)
- [ ] Integración con VS Code
- [ ] Modo offline completo (sin Docker)
- [ ] Análisis de screenshots
- [ ] Aprendizaje de patrones del proyecto

## Licencia

MIT - Igual que el resto de Healify.
