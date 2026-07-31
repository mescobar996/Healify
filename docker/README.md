# Healify AI - Docker

IA local para Healify usando Ollama + Open WebUI.

## Requisitos

- Docker Desktop (Windows/Mac/Linux)
- 8GB+ RAM recomendado

## Instalación Rápida

```bash
cd docker
docker-compose up -d
```

## Acceso

| Servicio | URL |
|----------|-----|
| Open WebUI | http://localhost:3000 |
| Ollama API | http://localhost:11434 |

Ambos puertos se publican solo en loopback (`127.0.0.1`), no en toda la red —
Ollama no tiene autenticación propia, así que no conviene exponerlo a la LAN.
Open WebUI pide crear una cuenta la primera vez que entrás a
`http://localhost:3000`; esa cuenta queda como admin.

## Modelos por RAM

| RAM | Modelo | Tamaño | Velocidad |
|-----|--------|--------|-----------|
| 4-6GB | `phi3:mini` | ~2GB | Rápido |
| 8-12GB | `llama3.2:3b` | ~2GB | Balanceado |
| 16GB+ | `llama3.1:8b` | ~5GB | Calidad |

## Descargar Modelo

```bash
# Opción 1: Via terminal
docker exec -it healify-ollama ollama pull llama3.2:3b

# Opción 2: Via Open WebUI
# Abrir http://localhost:3000 → Models → Pull
```

## Verificar Instalación

```bash
# Ollama corriendo?
curl http://localhost:11434/api/tags

# Modelo listo?
curl http://localhost:11434/api/tags | grep llama
```

## Uso con Healify

Una vez que Ollama está corriendo con un modelo descargado:

```bash
npx @healify/cli ai setup
npx @healify/cli ai explain "[data-testid='btn']"
npx @healify/cli ai chat
```

## Comandos Útiles

```bash
# Ver contenedores
docker ps

# Ver logs de Ollama
docker logs healify-ollama

# Ver logs de Open WebUI
docker logs healify-open-webui

# Detener todo
docker-compose down

# Detener y limpiar
docker-compose down -v
```

## Solución de Problemas

### "Ollama no detectado"
```bash
# Verificar que Ollama está corriendo
docker ps | grep healify-ollama

# Reiniciar si es necesario
docker-compose restart ollama
```

### "Modelo no encontrado"
```bash
# Listar modelos instalados
docker exec -it healify-ollama ollama list

# Descargar modelo
docker exec -it healify-ollama ollama pull llama3.2:3b
```

### "Puerto 11434 en uso"
```bash
# Cambiar puerto en docker-compose.yml
ports:
  - "11435:11434"
```
