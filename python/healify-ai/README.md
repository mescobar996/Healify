# healify-ai

IA local para Healify usando Ollama. Para equipos que no usan Node.js.

## Instalación

```bash
pip install healify-ai
```

## Requisitos

- Python 3.8+
- Ollama corriendo (local o en Docker)

## Uso

```bash
# Configurar IA
healify-ai setup

# Ver estado
healify-ai status

# Explicar un selector
healify-ai explain "[data-testid='btn']"

# Chat interactivo
healify-ai chat

# Listar modelos
healify-ai models
```

## Uso como Librería

```python
from healify_ai import HealifyAI

# Inicializar
ai = HealifyAI()
result = ai.init()

if result["success"]:
    # Explicar un selector
    explanation = ai.explain_selector("[data-testid='btn']")
    print(explanation)
    
    # Sugerir fix
    fix = ai.suggest_fix("[data-testid='btn']", "<button>Click</button>")
    print(f"Fix: {fix['proposed']}")
    
    # Chat
    response = ai.chat("¿Por qué falla mi test?")
    print(response)
```

## Configuración

Crea `healify.config.json` en la raíz de tu proyecto:

```json
{
  "ai": {
    "enabled": true,
    "model": "llama3.2:3b",
    "language": "es",
    "autoFix": false
  }
}
```

## Modelos Recomendados

RAM total del sistema — `suggest_model()` reserva 2GB para el sistema operativo antes
de elegir.

| RAM total | Modelo | Tamaño |
|-----------|--------|--------|
| hasta 9GB | phi3:mini | ~2GB |
| 10-17GB | llama3.2:3b | ~2GB |
| 18GB+ | llama3.1:8b | ~5GB |

## Licencia

MIT
