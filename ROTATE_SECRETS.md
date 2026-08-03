# ROTATE SECRETS — Healify

**⚠️ ACCIÓN REQUERIDA: Rotar TODOS los credenciales listados abajo.**

El archivo `.env` contiene credenciales de producción que nunca deben ser commiteadas.
Si este archivo fue commiteado en algún momento, todas las credenciales deben considerarse comprometidas.

## Credenciales a rotar

| # | Variable | Servicio | Cómo rotar |
|---|----------|----------|------------|
| 1 | `DATABASE_URL` | Supabase PostgreSQL | Dashboard → Settings → Database → Reset password |
| 2 | `DIRECT_DATABASE_URL` | Supabase PostgreSQL | Mismo proceso que #1 |
| 3 | `NEXTAUTH_SECRET` | NextAuth.js | Generar nuevo: `openssl rand -base64 32` |
| 4 | `GOOGLE_CLIENT_ID` | Google OAuth | console.cloud.google.com → Credentials → Regenerate |
| 5 | `GOOGLE_CLIENT_SECRET` | Google OAuth | console.cloud.google.com → Credentials → Regenerate |
| 6 | `GITHUB_ID` | GitHub OAuth | github.com/settings/developers → New client secret |
| 7 | `GITHUB_CLIENT_SECRET` | GitHub OAuth | Mismo proceso que #6 |
| 8 | `GITHUB_TOKEN` | GitHub PAT | github.com/settings/tokens → Delete old, create new |
| 9 | `REDIS_URL` | Railway Redis | Railway dashboard → Variables → Regenerate password |
| 10 | `MERCADOPAGO_ACCESS_TOKEN` | MercadoPago | mercadopago.com.ar → Tu cuenta → Credenciales |
| 11 | `MERCADOPAGO_WEBHOOK_SECRET` | MercadoPago | mercadopago.com.ar → Tu cuenta → Webhooks |
| 12 | `MERCADOPAGO_ENTERPRISE_PLAN_ID` | MercadoPago | mercadopago.com.ar → Tu cuenta → Planes |
| 13 | `MERCADOPAGO_PRO_PLAN_ID` | MercadoPago | Mismo proceso que #12 |
| 14 | `MERCADOPAGO_STARTER_PLAN_ID` | MercadoPago | Mismo proceso que #12 |
| 15 | `CRON_SECRET` | Healify | Generar nuevo: `openssl rand -hex 32` |
| 16 | `ENCRYPTION_KEY` | Healify | Generar nuevo: `openssl rand -hex 32` |
| 17 | `RESEND_API_KEY` | Resend | resend.com → API Keys → Create new key |
| 18 | `GITHUB_WEBHOOK_SECRET` | GitHub Webhooks | Generar nuevo: `openssl rand -hex 32` |

## Proceso de rotación

1. **Primero:** Cambiar TODOS los secrets en sus servicios correspondientes
2. **Segundo:** Actualizar `.env` con los nuevos valores
3. **Tercero:** Verificar que la app funciona con los nuevos secrets
4. **Cuarto:** Si el repo fue commiteado, hacer `git filter-branch` o BFG para limpiar el historial

## Verificación

```bash
# Verificar que .env nunca fue commiteado
git log --all --full-history -- .env

# Si aparece en el historial, limpiar con BFG:
# bfg --delete-files .env
# git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

## Prevención

- `.env` ya está en `.gitignore` (confirmado)
- Usar `scripts/validate-env.ts` para detectar variables faltantes en runtime
- Considerar migrar a un secrets manager (Vercel Environment Variables, Doppler, etc.)
