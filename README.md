<div align="center">
  <img src="public/icon.png" alt="Healify Logo" width="64" />
  <h1>Healify</h1>
  <p><strong>AI-powered test self-healing platform.</strong><br/>When your E2E tests break, Healify fixes them automatically and opens a Pull Request.</p>

  <p>
    <a href="https://healify-sigma.vercel.app">🌐 Live Demo</a> ·
    <a href="https://healify-sigma.vercel.app/docs">📚 Docs</a> ·
    <a href="docs/INFORME_ESTADO_VISION_PRODUCTO_2026-02.md">🧭 Informe 2026</a> ·
    <a href="docs/METRICAS_Y_KPIS_2026.md">📈 Métricas/KPI</a> ·
    <a href="#quick-start">🚀 Quick Start</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Playwright-1.58-green?logo=playwright" alt="Playwright" />
    <img src="https://img.shields.io/badge/tests-passing-brightgreen" alt="Tests" />
    <img src="https://img.shields.io/badge/Railway-Worker-purple" alt="Railway" />
  </p>
</div>

---

## ✨ What it does

Healify monitors your Playwright/Cypress/Jest test runs. When a test fails due to a broken selector, the AI engine analyzes the DOM, generates a fix with a confidence score, and if confidence ≥ 95% it automatically opens a Pull Request to your repository.

```
Push to GitHub → Webhook → Railway Worker → Run Tests → AI Healing → Auto PR
```

## 🗂 Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Framer Motion |
| Auth | NextAuth v4 (GitHub OAuth) |
| Database | PostgreSQL via Neon + Prisma ORM |
| Queue | BullMQ + Redis |
| Worker | Railway (Node.js, clones repo, runs Playwright) |
| Payments | MercadoPago (Subscriptions + Webhooks) |
| Email | Resend |
| Deploy | Vercel (app) + Railway (worker) |

## 🚀 Quick Start

### 1. Clone & install
```bash
git clone https://github.com/mescobar996/Healify.git
cd Healify
npm install
```

### 2. Environment variables
```bash
cp .env.example .env.local
# Fill in the required values (see below)
```

### 3. Database setup
```bash
npx prisma generate
npx prisma db push
```

### 4. Run locally
```bash
npm run dev          # Next.js app → http://localhost:3000
npm run build:worker # Build the Railway worker
```

## 🔑 Required environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon recommended) |
| `NEXTAUTH_SECRET` | Random secret for NextAuth session encryption |
| `NEXTAUTH_URL` | Your app URL (`http://localhost:3000` for local) |
| `GITHUB_ID` | GitHub OAuth App Client ID |
| `GITHUB_SECRET` | GitHub OAuth App Client Secret |
| `GITHUB_WEBHOOK_SECRET` | Secret for validating GitHub webhook signatures |
| `REDIS_URL` | Redis connection string (Upstash or Railway Redis) |

### Optional (for full functionality)
| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key for payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_STARTER_PRICE_ID` | Stripe Price ID for Starter plan |
| `STRIPE_PRO_PRICE_ID` | Stripe Price ID for Pro plan |
| `STRIPE_ENTERPRISE_PRICE_ID` | Stripe Price ID for Enterprise plan |
| `RESEND_API_KEY` | Resend API key for transactional emails |
| `NEXT_PUBLIC_APP_URL` | Public URL of your app |
| `CRON_SECRET` | Secret token to protect internal cron endpoints |

## 🧪 Testing

```bash
npm test                  # Unit tests (Vitest)
npm run test:e2e          # E2E tests (Playwright)
npm run test:e2e:api      # API tests only (no browser needed)
npm run test:all          # Unit + API E2E tests
```

## 📁 Project structure

```
src/
├── app/
│   ├── api/            # 32 API routes
│   ├── auth/           # Sign in / error pages
│   ├── dashboard/      # Protected dashboard pages
│   ├── docs/           # SDK documentation page
│   └── pricing/        # Pricing page
├── components/         # Reusable UI components
├── lib/
│   ├── ai/             # Healing engine
│   ├── engine/         # Core healing logic
│   ├── github/         # GitHub integration (webhook, PRs)
│   └── __tests__/      # Unit test suites
└── workers/
    └── railway-worker.ts  # Long-running worker (clone → test → heal → PR)
```

## 🔄 How healing works

1. **Reporter** sends test failure to `POST /api/v1/report` with the broken selector + error
2. **Healing Engine** analyzes the DOM context using AI
3. If **confidence ≥ 95%** → auto-applies the fix and opens a PR
4. If **confidence 70–94%** → marks as `NEEDS_REVIEW` in the dashboard
5. If **confidence < 70%** → marks as `FAILED`, sends notification

## 📡 API

```bash
POST /api/v1/report
x-api-key: hf_live_xxxxxxxx

{
  "testName": "Login / should authenticate",
  "selector": "#login-btn",
  "error": "Waiting for selector timeout",
  "context": "<html>...</html>"
}
```

Full API reference at [/docs](https://healify-sigma.vercel.app/docs).

## 🚢 Deploy

**App (Vercel):**
```bash
vercel deploy --prod
```

**Worker (Railway):**
The worker is deployed automatically. Set the start command to:
```
node dist/worker.js
```

### Weekly report cron

Trigger the weekly report endpoint with your secret:

```bash
curl -X GET "https://your-domain.com/api/cron/weekly-report" \
  -H "Authorization: Bearer $CRON_SECRET"
```

For Vercel Cron, add a schedule (e.g. Mondays at 08:00 UTC) pointing to:

```
/api/cron/weekly-report
```

If `CRON_SECRET` is configured in your Vercel project, Vercel Cron automatically includes:

```text
Authorization: Bearer <CRON_SECRET>
```

## 📄 License

MIT © 2026 Healify
