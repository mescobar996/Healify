# Solución: error=Callback al iniciar sesión con GitHub

Si ves `error=Callback` en la URL después de intentar "Continue with GitHub", verifica lo siguiente:

## 1. Variables de entorno en Vercel

En **Vercel → Project → Settings → Environment Variables**:

| Variable | Valor | Notas |
|----------|-------|-------|
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | Generar con: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://healify-sigma.vercel.app` | **Sin** barra final |
| `GITHUB_ID` | Tu Client ID de GitHub OAuth | |
| `GITHUB_SECRET` | Tu Client Secret de GitHub OAuth | |
| `DATABASE_URL` | Conexión PostgreSQL | **Neon.tech** recomendado para Vercel |

## 2. GitHub OAuth App

En **GitHub → Settings → Developer settings → OAuth Apps**:

- **Authorization callback URL** debe ser exactamente:
  ```
  https://healify-sigma.vercel.app/api/auth/callback/github
  ```

## 3. Base de datos

**Prisma usa SQLite por defecto** — en Vercel no funciona. Necesitas PostgreSQL:

1. Crear una base de datos en [Neon.tech](https://neon.tech) (gratis)
2. Copiar la connection string
3. En Vercel: `DATABASE_URL=postgresql://user:pass@host/db?sslmode=require`
4. Cambiar `prisma/schema.prisma`: `provider = "postgresql"`
5. Ejecutar: `npx prisma migrate deploy`

---

## 4. Diagnóstico rápido

Healify incluye un endpoint de diagnóstico:

```
GET /api/auth/check
```

Devuelve el estado de la sesión, las variables de entorno configuradas (sin secretos) y las tablas de auth en la BD. Úsalo para verificar que todo esté conectado antes de intentar login.

## 5. NEXTAUTH_URL — Validación automática

A partir del sprint de limpieza (marzo 2026), `NEXTAUTH_URL` se valida en `src/lib/env.ts`:

- Si **ni `NEXTAUTH_URL` ni `VERCEL_URL`** están definidas, el servidor falla al arrancar con un error claro.
- En Vercel, `VERCEL_URL` se inyecta automáticamente, pero se recomienda setear `NEXTAUTH_URL` explícitamente para evitar problemas con OAuth callbacks.

## 6. Google OAuth (opcional)

Si también querés habilitar "Continue with Google":

| Variable | Valor |
|----------|-------|
| `GOOGLE_CLIENT_ID` | Client ID de la consola de Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Client Secret |

Callback URL: `https://healify-sigma.vercel.app/api/auth/callback/google`
