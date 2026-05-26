# Superadmin — One-Page SOP

> **Role mission:** Run the platform. Users, integrations, pricing catalog, MSP brand profile, AI budget. *Aligned to portal v3.2.1.*

## You own
- Every user account + role assignment
- The pricing catalog (`SystemConfig.pricing.catalog`)
- The MSP brand profile (the system-prompt preamble Claude sees on every AI call)
- Integration health (Postgres, Resend, Anthropic, Blob, Mapbox, Daily)
- AI budget caps + spend monitoring
- The objections + outreach libraries

## You cannot
- Nothing technical. Operationally, defer to the COO on handoffs and to the Sales Manager on rep-level changes inside their org.

---

## Weekly rhythm

1. **`/admin` integration health row** — anything not green → fix or escalate
2. **`/admin/ai-usage`** — if MTD spend > 70% of budget by mid-month, raise the cap or tighten the per-lead cap
3. **`/admin/users`** — deactivate anyone who has left the company. Confirm role assignments still match
4. **`/admin/setup` → "Recover orphaned accounts"** — run monthly as a safety check
5. **`/admin/msp-profile`** — review with the COO quarterly. Win stories should always be < 12 months old

---

## First-run setup checklist (`/admin/setup`)

When a new tenant or environment spins up:

1. **Environment health** — AUTH_SECRET stable, DATABASE_URL configured, RESEND_API_KEY set, BLOB_READ_WRITE_TOKEN set, ANTHROPIC_API_KEY set
2. **Add real team** — replace the 5 seed demo users with real people at the right roles
3. **Review pricing catalog** — adjust bundle MRRs, seat tiers, onboarding fees, floors
4. **Import starter prospects** — 25-row Burbank shortlist (idempotent)
5. **Customize objections + outreach** — edit anything that doesn't match the company tone
6. **Test email delivery** — sign out, sign back in via magic-link to confirm Resend works

---

## The five admin surfaces

| Surface | What you do there |
|---|---|
| `/admin` | Hub — integration health pills, setup CTA, audit log feed, tile grid to everything below |
| `/admin/users` | Add/edit/deactivate any user. Role pill is inline-editable. Tone-coded per role |
| `/admin/pricing` | Bundles · Standalone lines · Per-unit (reference, read-only) · Advanced JSON. Changes propagate instantly |
| `/admin/objections` | Reference library Lin sees inside each lead's Objections tab. Filter by category + industry |
| `/admin/outreach` | Email/LinkedIn templates with `{{placeholder}}` substitution. Filter by category + industry + trigger |
| `/admin/msp-profile` | Identity · Services emphasis · Markets + positioning · Win stories · Preview · Advanced JSON |
| `/admin/ai-usage` | MTD spend, per-feature breakdown, recent calls. Filter by feature or by lead |
| `/admin/audit` | Every change in the portal, ever |
| `/admin/setup` | First-run wizard + maintenance tools (orphan recovery, lead wipe) |

---

## MSP brand profile — the AI's source of truth

`/admin/msp-profile` is the **single source of truth for how the company talks**. Every Claude call reads it as the system-prompt preamble. The Preview tab shows you exactly what Claude sees.

Six tabs:
- **Identity** — company name, location, tagline, mission, brand voice, background
- **Services** — emphasis per service line: `focus` / `normal` / `de-emphasize` (+ optional note)
- **Markets** — target verticals, differentiators, out-of-scope list
- **Win stories** — anonymized customer wins the AI cites in objection rebuttals and outreach
- **Preview** — live render of the assembled prompt block
- **Advanced JSON** — for bulk edits or paste-from-backup

> Treat the brand voice like a style guide. Specific dos and don'ts. "Warm + direct, no MBA-speak. Specific over generic." beats "be professional."

---

## AI budget management

`/admin/ai-usage` shows MTD spend against the org cap.

| Spend % of budget | Your move |
|---|---|
| < 70% | Nothing — let it run |
| 70–90% | Watch daily. Decide whether to raise the cap or tighten per-lead cap |
| > 90% | Tighten per-lead cap immediately. Decide whether to raise org cap or wait for new month |

Per-lead cap protects a single deal from blowing the budget. Org cap protects the month. Tune both in `/admin/config`.

---

## Pricing catalog discipline

- **Always edit by tabs first** (Bundles, Standalone, Per-unit reference)
- **Only use Advanced JSON for pasting a known-good backup**
- **Every change writes to audit log** — actor + before/after diff
- **Print the Bundles tab after any change** so the paper kit stays current
- **Reset to defaults** is available but always-confirmed. The "defaults" are whatever was last committed in `src/lib/pricing/catalog.ts`

---

## Maintenance you run

| Tool | When | Effect |
|---|---|---|
| `/admin/setup` → Recover orphaned accounts | Monthly safety check or after a known partial-accept failure | Scans accepted handoffs missing a Customer row, creates them. Idempotent |
| `/admin/setup` → Wipe all leads | Only before a clean demo reset | **Irreversible.** Deletes every Lead and cascades to children. Two-click confirm |
| `/admin/users` → Deactivate | When someone leaves the company | Revokes portal access immediately. **Reassign their leads first** (Sales Manager can do this from rep detail) |

---

## Quick rules

- **Never share a Superadmin account.** Every action is logged to the actor — shared accounts destroy the audit trail.
- **Production pricing changes get a Slack heads-up first.** Catalog changes propagate instantly to every PricingCard — let the sales team know.
- **MSP profile changes are quarterly conversations.** Don't tweak brand voice mid-quarter without COO sign-off.
- **AI budget is a hard cap.** When it hits, AI features return errors. Don't let it surprise you.
- **`/admin/audit` is the legal record.** Never delete from it. Never bypass it.
