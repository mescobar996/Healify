<div align="center">
  <img src="public/icon.png" alt="Healify Logo" width="72" />

  <h1>Healify</h1>

  <p><strong>Your tests break. Healify fixes them — automatically.</strong></p>

  <p>
    <a href="https://healify-sigma.vercel.app">🌐 Live App</a> ·
    <a href="https://healify-sigma.vercel.app/docs">📚 Documentation</a> ·
    <a href="https://healify-sigma.vercel.app/pricing">💳 Pricing</a> ·
    <a href="#-quick-start">🚀 Get Started in 5 min</a>
  </p>

  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/Playwright-1.58-green?logo=playwright" />
  <img src="https://img.shields.io/badge/tests-passing-brightgreen" />
  <img src="https://img.shields.io/badge/deployed-Vercel-black" />
</div>

---

## 🩺 The problem Healify solves

Every time a developer changes a button, renames a field, or updates a UI component — **tests break**. Not because the feature is broken, but because the test was looking for something that moved.

Fixing broken selectors is repetitive, slow, and blocks your entire team.

**Healify watches your tests, understands what broke, and opens a Pull Request with the fix — before you even notice the failure.**

---

## ✨ How it works (in plain English)
```
Push code → tests run → one fails → Healify analyzes why
→ generates a fix → opens a Pull Request automatically
```

No manual investigation. Just a PR waiting for your approval.

> **Real example:** Your test clicks `#login-btn`. A dev renamed it to `[data-testid="login-btn"]`.  
> Healify detects the change, generates the fix at **97% confidence**, and opens a PR — in under 2 minutes.

---

## 🎯 Who is it for?

| If you are... | Healify helps you... |
|---|---|
| 🧑‍💻 A developer | Stop wasting hours debugging flaky selectors |
| 🧪 A QA engineer | Maintain a healthy test suite without chasing UI changes |
| 🚀 A startup | Ship faster without breaking your pipeline |
| 🏢 A team lead | Cut test maintenance cost across the board |

---

## 🔑 Core features

- **Auto-healing** — Detects broken CSS/XPath/test-id selectors and fixes them
- **Pull Request workflow** — Every fix goes through a PR. You stay in control, always
- **Confidence scoring** — Only auto-applies fixes at ≥95% confidence. Lower = flagged for review
- **Works with your stack** — Playwright, Cypress, Jest, Vitest, Selenium
- **CI/CD ready** — GitHub Actions and GitLab CI support out of the box
- **Jira integration** — Unresolved bugs become Jira tickets automatically
- **Dashboard** — Real-time view of test health, healing rate, and pending reviews

---

## 📊 Healing confidence levels

| Confidence | What happens |
|---|---|
| ≥ 95% | Fix applied → Pull Request opened automatically ✅ |
| 70–94% | Flagged as `NEEDS_REVIEW` in your dashboard 🔍 |
| < 70% | Marked as `FAILED` → notification sent, manual review needed ⚠️ |

---

## 🚀 Quick Start

**1. Install the reporter**
```bash
npm install --save-dev @healify/test-runner
```

**2. Add your API Key** *(from Settings → API Keys)*
```env
HEALIFY_API_KEY=hf_live_xxxxxxxxxxxxxxxx
```

**3. Connect your GitHub repo** *(Projects → Connect repo in the dashboard)*

Done. Next time a test breaks, Healify handles it.

📖 Full guide → [healify-sigma.vercel.app/docs](https://healify-sigma.vercel.app/docs)

---

## 🗂 Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Framer Motion, shadcn/ui |
| Auth | NextAuth v4 (GitHub + Google OAuth) |
| Database | PostgreSQL (Neon) + Prisma ORM (15+ models) |
| AI Engine | Ollama local LLM (qwen2.5-coder:7b) + deterministic fallback |
| Queue | BullMQ + Redis |
| Worker | Railway (Docker) — clones repo, runs Playwright, triggers healing, opens PRs |
| Payments | MercadoPago (ARS), Lemon Squeezy (USD), Stripe (legacy) |
| SDK Packages | @healify/test-runner (Playwright), @healify/cypress-plugin (Cypress) |
| Monitoring | Sentry (errors), Vercel Analytics |
| Deploy | Vercel (app) + Railway (worker) |

---

## 🧪 Running tests
```bash
npm test                  # Unit tests (Vitest)
npm run test:e2e          # E2E tests (Playwright)
npm run test:e2e:api      # API tests — no browser needed
npm run test:all          # Everything
```

---

## ⚙️ Local setup
```bash
git clone https://github.com/mescobar996/Healify.git
cd Healify
npm install
cp .env.example .env.local
npx prisma generate
npx prisma db push
npm run dev               # → http://localhost:3000
```

<details>
<summary>📋 Environment variables</summary>

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon recommended) |
| `NEXTAUTH_SECRET` | NextAuth session encryption secret |
| `NEXTAUTH_URL` | Your app URL |
| `GITHUB_ID` | GitHub OAuth App Client ID |
| `GITHUB_SECRET` | GitHub OAuth App Client Secret |
| `GITHUB_WEBHOOK_SECRET` | Secret for validating GitHub webhook payloads |
| `REDIS_URL` | Redis connection string (Upstash or Railway Redis) |

Optional variables for payments, email, and cron are documented in `.env.example`.
</details>

---

## 📁 Project structure
```
src/
├── app/
│   ├── api/                # 65+ API routes (healing, projects, tests, billing, webhooks, cron)
│   ├── auth/               # Sign-in / error pages
│   ├── dashboard/          # Protected dashboard (overview, projects, tests, healing, settings, team)
│   ├── docs/               # SDK documentation
│   ├── pricing/            # Plans & pricing (temporarily disabled)
│   ├── privacy/            # Privacy policy
│   ├── terms/              # Terms of service
│   ├── refund/             # Refund policy
│   └── support/            # Support page
├── components/
│   ├── dashboard/          # Dashboard-specific (MetricCard, StatusBadge, charts, ROI)
│   ├── landing/            # Landing page sections (hero, features, how-it-works, CTA)
│   └── ui/                 # shadcn/ui primitives (button, dialog, tabs, sheet, etc.)
├── hooks/                  # Custom React hooks
├── lib/
│   ├── ai/                 # AI healing engine (Ollama LLM + deterministic fallback)
│   ├── auth/               # Session management
│   ├── engine/             # Deterministic healing engine (pattern analysis)
│   ├── github/             # Webhook & Pull Request automation
│   └── payment/            # MercadoPago integration
├── types/                  # TypeScript type definitions
└── workers/
    ├── lib/                # Worker utilities (git-ops, playwright-runner, event-bus)
    └── railway-worker.ts   # Background worker: clone → test → heal → PR

# Monorepo workspace packages
reporter-core/              # Shared HTTP client, config, selector extraction
test-runner/                # @healify/test-runner (Playwright reporter + DOM capture)
cypress-plugin/             # @healify/cypress-plugin (Cypress integration)
cli/                        # CLI tool (scaffolded)
```

---

## 🤝 Contributing

PRs are welcome. For major changes, open an issue first.

---

## 📄 License

MIT © 2026 Healify
