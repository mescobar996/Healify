# 🚀 Guía de Deploy: Healify Worker en Railway

Esta guía te llevará paso a paso para deployar el worker de Playwright en Railway y conectarlo con tu aplicación en Vercel.

---

## 📋 Prerrequisitos

- Cuenta en [Railway.app](https://railway.app) (puedes usar GitHub para login)
- Tu proyecto Healify ya deployado en Vercel
- Repositorio en GitHub con el código actualizado

---

## Paso 1: Crear Proyecto en Railway

1. Ve a [railway.app](https://railway.app) y haz login con tu cuenta de GitHub
2. Click en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Autoriza Railway a acceder a tu repositorio `mescobar996/Healify`
5. Selecciona el repositorio

---

## Paso 2: Provisionar Redis

Railway puede provisionar Redis automáticamente:

1. En tu proyecto de Railway, click en **"+ New"**
2. Selecciona **"Database"** → **"Add Redis"**
3. Railway creará una instancia de Redis
4. Click en la instancia de Redis → **"Variables"**
5. Copia la variable `REDIS_URL`

Alternativamente, usa Upstash (gratis para proyectos pequeños):
- Ve a [upstash.com](https://upstash.com)
- Crea una cuenta y un Redis database
- Copia la `UPSTASH_REDIS_REST_URL` (o usa el formato `redis://default:PASSWORD@ENDPOINT`)

---

## Paso 3: Configurar Variables de Entorno

En Railway, ve a tu servicio (el que tiene tu código) → **"Variables"** y agrega:

### Variables OBLIGATORIAS

```bash
# Base de datos (usar la misma que en Vercel)
DATABASE_URL=postgresql://...@...neon.tech/...?sslmode=require

# Redis (copiar del paso anterior)
REDIS_URL=redis://default:PASSWORD@HOST:PORT

# Entorno
NODE_ENV=production
```

### Variables RECOMENDADAS

```bash
# Para IA de healing (sin esto usa modo determinístico)
OPENAI_API_KEY=sk-proj-...

# Auth de NextAuth (usar el mismo que en Vercel)
NEXTAUTH_SECRET=tu-secreto-muy-largo-y-seguro
NEXTAUTH_URL=https://healify-sigma.vercel.app

# GitHub OAuth (para clonar repos privados y crear PRs)
GITHUB_WEBHOOK_SECRET=tu-webhook-secret
```

---

## Paso 4: Configurar el Servicio Worker

Railway detectará automáticamente el `Dockerfile.railway`. Pero necesitamos asegurarnos de que use el correcto:

1. Click en tu servicio → **"Settings"**
2. En **"Build"**, verifica:
   - Builder: **Dockerfile**
   - Dockerfile Path: `Dockerfile.railway`
3. En **"Deploy"**:
   - Restart Policy: **On Failure**
   - Max Retries: **3**

---

## Paso 5: Configurar Dominio (Opcional)

Para monitorear el worker:

1. Click en tu servicio → **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. Railway te dará una URL como `healify-worker-production.up.railway.app`

---

## Paso 6: Variables de Entorno en Vercel

Ahora necesitas conectar Vercel con Railway. En Vercel:

1. Ve a tu proyecto → **Settings** → **Environment Variables**
2. Agrega:

```bash
REDIS_URL=tu-redis-url-de-railway
```

**Importante:** Usa la misma URL de Redis que configuraste en Railway.

---

## Paso 7: Verificar el Deploy

### En Railway:

1. Click en tu servicio → **"Deployments"**
2. Verifica que el status sea **"SUCCESS"**
3. Click en el deployment → **"Logs"**
4. Deberías ver:

```
========================================
🚀 HEALIFY RAILWAY WORKER STARTING
========================================
✅ Redis connected
📦 Queue: test_execution_queue
🔧 Environment: production

🎯 Worker ready and listening for jobs...
```

### Probar el flujo:

1. Haz un push a tu repositorio conectado
2. Ve a los logs del worker en Railway
3. Deberías ver el job siendo procesado

---

## 📊 Monitoreo

### Logs en tiempo real:
```bash
railway logs -f
```

### Estado de la cola:
Puedes agregar un endpoint de health check en el worker:

```typescript
// El worker ya tiene health check integrado
// Railway lo usará automáticamente
```

### Métricas:
Railway muestra en el dashboard:
- CPU usage
- Memory usage
- Network I/O
- Restart count

---

## 🔧 Troubleshooting

### Error: "Redis connection refused"
- Verifica que `REDIS_URL` esté configurada correctamente
- Asegúrate de que Redis esté corriendo en Railway

### Error: "Database connection failed"
- Verifica `DATABASE_URL` - debe ser la misma que en Vercel
- Neon puede tener límites de conexiones concurrentes

### Error: "Playwright browsers not found"
- El Dockerfile usa la imagen oficial de Playwright
- Si falla, puedes agregar al Dockerfile:
  ```dockerfile
  RUN npx playwright install chromium --with-deps
  ```

### Error: "Out of memory"
- Railway puede necesitar más RAM para Playwright
- Aumenta los recursos en Railway → Settings → Resources

---

## 💰 Costos Estimados

| Servicio | Uso | Costo |
|----------|-----|-------|
| Railway (Worker + Redis) | ~5-10 jobs/día | $3-5/mes |
| Upstash Redis (alternativa) | 10K requests/día | GRATIS |
| Neon DB | Ya lo tienes | $0 |

**Recomendación:** Empieza con Railway (tiene $5 gratis/mes) y si necesitas escalar, considera separar Redis a Upstash.

---

## 🎉 ¡Listo!

Tu arquitectura completa ahora es:

```
[GitHub Push]
     ↓
[Vercel Webhook] → crea TestRun → addTestJob()
     ↓
[Railway Redis] ← BullMQ Queue
     ↓
[Railway Worker] → Clona repo → Playwright → Healing → Auto-PR
     ↓
[Neon PostgreSQL] ← Actualiza TestRun
     ↓
[Usuario ve resultados en Dashboard]
```

---

## Próximos Pasos

1. ✅ Webhook con auto-enqueue → **LISTO**
2. ✅ Worker Railway con Playwright → **LISTO**
3. ⏳ Probar flujo end-to-end
4. ⏳ Tests unitarios (Jest/Vitest)

¿Preguntas? Revisa los logs del worker o contacta soporte.
