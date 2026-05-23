# Gateway TelNet Sales Portal

Responsive Next.js 15 app that runs Gateway TelNet's complete sales process — lead capture, pipeline tracking, in-person IT assessments with scoring, outreach, and Sales-to-Ops handoff.

Brand-aligned. Mobile-first. Audit-logged. RBAC-enforced.

---

## Stack

- **Framework:** Next.js 15 (App Router) · React 19 · TypeScript 5.6 (strict)
- **DB / ORM:** PostgreSQL 16 · Prisma 5
- **Auth:** NextAuth v5 — magic link via Resend (primary) + email/password fallback (bcrypt)
- **Email:** Resend
- **AI:** `@anthropic-ai/sdk` (wired; deferred for v1.1)
- **UI:** Tailwind 3.4 + shadcn-style primitives · lucide-react · sonner · `@dnd-kit` placeholders
- **PWA:** `next-pwa` (installable on iPhone home screen)
- **Tests:** Vitest (scoring engine) + Playwright (e2e)
- **Hosting target:** Vercel + Vercel Postgres

---

## Quick start (local)

Prerequisites: Node 20 LTS, npm, Docker.

```bash
# 1. Start Postgres in Docker (port 5433 so it doesn't clash with a local Postgres)
npm run db:up

# 2. Copy env template
cp .env.example .env.local
#    (edit .env.local if you want to plug in your real Resend / Anthropic keys)

# 3. Install deps + generate Prisma client
npm install

# 4. Apply migrations + seed users and demo leads
npm run db:migrate           # first time only
npm run db:seed

# 5. Run dev server
npm run dev
```

Open http://localhost:3000.

### Seed login

All seed users share the dev password **`gateway123`** (magic link also works once `RESEND_API_KEY` is configured).

| Email | Role |
| --- | --- |
| `admin@gatewaytelnet.com` | SUPERADMIN |
| `lin@gatewaytelnet.com` | SALESPERSON |
| `salesmgr@gatewaytelnet.com` | SALES_MANAGER |
| `teejay@gatewaytelnet.com` | VCIO |
| `coo@gatewaytelnet.com` | COO |

Plus 5 demo leads spanning Medical, Legal, Federal Contracting, Manufacturing, Hospitality.

---

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next dev server (http://localhost:3000) |
| `npm run build` | `prisma generate` then `next build` |
| `npm run start` | Run the production build |
| `npm run db:up` | Start Docker Postgres |
| `npm run db:down` | Stop Docker Postgres |
| `npm run db:migrate` | Create + apply a dev migration |
| `npm run db:migrate:deploy` | Apply migrations (for prod / CI) |
| `npm run db:seed` | Seed users + 5 demo leads + scoring thresholds |
| `npm run db:reset` | Drop, migrate, re-seed (full reset) |
| `npm run db:studio` | Prisma Studio |
| `npm run test:unit` | Vitest — scoring engine math |
| `npm run test:e2e` | Playwright — three critical user flows |
| `npm test` | Unit + e2e |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | next lint |

---

## Deploying to Vercel (one-time setup)

This repo is pre-configured so every push to `main` runs migrations, seeds demo data, and deploys. The committed `.env.production` carries only non-secret defaults. Two secrets must be set once in the Vercel UI.

### Steps

**1. Import the repo on Vercel** — vercel.com → **Add New → Project** → pick `simpletech310/SimpleSalesGW`. Framework auto-detects as Next.js. Click **Deploy** (the first build may complete with warnings — that's fine).

**2. Paste two secrets** — in the project, **Settings → Environment Variables**, add:

| Name | How to generate |
| --- | --- |
| `AUTH_SECRET` | `openssl rand -base64 48` on your terminal |
| `ANTHROPIC_API_KEY` | from https://console.anthropic.com/ |

(Optional: `RESEND_API_KEY` for live email — without it, outreach is logged as an Activity but no email is sent.)

**3. Connect Vercel Postgres** — **Storage → Create Database → Postgres**. Vercel auto-injects `DATABASE_URL`.

**4. Connect Vercel Blob** — **Storage → Create Store → Blob**. Auto-injects `BLOB_READ_WRITE_TOKEN`.

**5. Redeploy** — click **Redeploy** on the latest deployment. From this point on, every push to `main` redeploys automatically.

### What happens on each push

`scripts/vercel-build.mjs` runs:

1. `prisma generate`
2. If `DATABASE_URL` is present: `prisma migrate deploy` then `tsx prisma/seed.ts` (idempotent — recreates demo data if missing).
3. If `DATABASE_URL` is absent: skips DB ops with a warning so the build still succeeds.
4. `next build`.

`AUTH_URL` and `NEXT_PUBLIC_APP_URL` are derived automatically from `VERCEL_URL` at both build and runtime — no manual entry.

### Env-var summary

| Var | Where it's set | Required for |
| --- | --- | --- |
| `AUTH_SECRET` | Vercel UI (you paste) | session signing |
| `ANTHROPIC_API_KEY` | Vercel UI (you paste) | Claude research summary; AI features gracefully off without it |
| `DATABASE_URL` | Vercel Postgres integration | everything |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob integration | file attachments only |
| `RESEND_API_KEY` | Vercel UI (optional) | live outreach email send |
| everything else | committed in `.env.production` | non-secret defaults |

---

## Architecture

```
src/
  app/
    (app)/                     # authenticated app shell (header, footer, bottom nav)
      page.tsx                 # home = Pipeline Kanban
      leads/                   # list, new, [id] detail tabs, assessment, outreach, handoff
      assessment/[id]/         # one-question-per-screen flow + result
      admin/                   # users, audit, config (RBAC gated)
      me/                      # current user, open next-actions
    login/                     # public — magic link + password tabs
    api/                       # JSON endpoints — every state change writes audit log
  components/
    brand/GatewayLogo.tsx      # italic Gateway + tracked TELNET
    layout/AppShell.tsx        # navy header + lavender footer + mobile bottom nav
    pipeline/PipelineBoard.tsx # drag-and-drop kanban
    ui/                        # Button / Input / Card primitives
  lib/
    audit.ts                   # writeAudit — single audit entry point
    rbac.ts                    # role × permission matrix
    scoring/engine.ts          # Services + Customer + Deal Quality math
    assessment/questions.ts    # 25-question bank
    outreach/templates.ts      # static template library (v1.1: load from CMS)
    email/render.ts            # branded HTML email shell
    prisma.ts, env.ts, api.ts, strings.ts, utils.ts
prisma/
  schema.prisma                # Section 6 contract — all enums + indexes
  seed.ts                      # 5 users + 5 demo leads + config row
tests/
  unit/scoring.test.ts         # 30+ assertions covering all 8 service triggers,
                               # all 8 customer-score buckets, blend + non-strategic flag
  e2e/                         # create-lead · run-assessment · initiate-handoff
```

---

## Scoring engine

Per Section 9 of the PRD. Tunable defaults live in `src/lib/scoring/engine.ts → SCORING_DEFAULTS`. Tests pin every weight + threshold.

- **Services Score:** sum of triggered service-line weights, capped at 100
- **Customer Score:** sum of 8 dimensions (industry, size, geography, growth, authority, budget, timeline, compliance), capped at 100
- **Deal Quality:** `round(services × 0.45 + customer × 0.55)`
- **Non-strategic flag:** services < 35 OR deal quality < 40 (thresholds tunable from Admin → System config)
- **Bucket:** 85+ Lighthouse · 70+ Strong Fit · 50+ Marginal · 30+ Refer/Wait · else Polite Decline

---

## v1.1 features (live)

| Feature | What it does | Where |
| --- | --- | --- |
| Self-service magic-link assessment | "Send link" on the Lead Assessment tab generates a tokenized URL and emails it via Resend. Respondent fills out the 25-question form at `/assessment/respond/[token]` with no login. Same scoring pipeline writes back to the Lead on submit. | `src/lib/assessment/tokens.ts`, `src/app/assessment/respond/[token]/*`, `src/lib/email/templates/assessment-invite.ts` |
| Claude research summary | "Summarize with Claude" on the Research tab calls Anthropic with a cached system prompt; returns `{ summary, suggestedQuestions, risks, fitSignals }`. Persists a `CLAUDE_SUMMARY` ResearchArtifact. | `src/lib/ai/anthropic.ts`, `src/lib/ai/research-summary.ts`, `POST /api/leads/[id]/research/summarize` |
| Website + LinkedIn + Google Business intel | "Gather research" fetches each public URL (robots-respecting, 384 KB cap, 6 s timeout), persists artifacts, then chains into the Claude summarizer. | `src/lib/scrape/*`, `POST /api/leads/[id]/research/gather` |
| File attachments | Drag-drop file upload on the Files tab via Vercel Blob direct-upload. 25 MB cap, allow-listed content types. | `src/lib/storage/blob.ts`, `src/app/api/leads/[id]/attachments/*`, `src/app/(app)/leads/[id]/FilesTab.tsx` |
| Offline note writes | Quick-note composer on the Overview tab persists to IndexedDB when offline; foreground drainer + Workbox `BackgroundSyncPlugin` retry on reconnect. Idempotent via per-note `clientId`. | `src/lib/offline/note-queue.ts`, `src/components/layout/OfflineQueueBanner.tsx`, runtime caching in `next.config.mjs` |
| Pricing approval workflow | Request / approve / reject on the Lead Pricing card. Routes ≤20 % to Sales Manager, >20 % to COO (Superadmin can approve any tier). | `src/lib/pricing.ts`, `src/app/api/leads/[id]/pricing-approvals/*`, `src/app/(app)/leads/[id]/PricingCard.tsx` |
| Notifications page | `/notifications` aggregates open next-actions (7 days), in-progress self-service assessments, pending pricing approvals in the user's queue, and handoffs waiting on the COO. | `src/lib/notifications.ts`, `src/app/(app)/notifications/page.tsx`, `GET /api/notifications` |

### New env vars (v1.1)

| Var | Purpose | Required? |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob auth | Required for file uploads; auto-injected on Vercel |
| `ASSESSMENT_LINK_EXPIRY_DAYS` | Magic-link expiry (default 14) | Optional |
| `SCRAPE_USER_AGENT` | UA string the scraper identifies with | Optional |

## Still stubbed for a future round

- ConnectWise PSA webhook (`/api/handoff/connectwise-webhook` returns 501) — needs PSA URL + auth from ops.
- Offline writes beyond notes.
- Calendar OAuth (mailto: + ICS for now).
- Forecasting / win-loss / coaching dashboards.
- DB-backed outreach template library (static config today).

---

## Troubleshooting

- **`docker compose up -d postgres` fails:** make sure Docker Desktop is running. The container exposes port **5433** to avoid clashing with a host Postgres.
- **`prisma migrate` cannot connect:** check that `DATABASE_URL` in `.env.local` points to `localhost:5433` (the Docker container), not 5432.
- **Magic-link emails not arriving:** `RESEND_API_KEY` is empty by default — outreach is logged as an Activity without sending. Set the key and either use `onboarding@resend.dev` (works immediately) or verify your own domain in Resend.
- **`Invalid environment variables`:** run with `.env.local` present; `AUTH_SECRET` must be ≥ 16 chars.

---

## Brand

CSS custom properties + Tailwind named tokens (`gtn-navy`, `gtn-purple`, `gtn-lavender`, `gtn-grey`, `gtn-green`, etc.) live in `src/app/globals.css` and `tailwind.config.ts`. Component patterns:

- Primary button: navy bg / white text / 6px radius
- Secondary: white bg / navy text / 1px navy border
- Cards: white / 1px lavender border / 8px radius / soft shadow
- Pipeline chips: purple bg / white text / pill
- Score badges: green ≥70 / amber 50–69 / red <50

Should match the Gateway PDF packet closely enough that someone with both open can't tell they're separate products.
