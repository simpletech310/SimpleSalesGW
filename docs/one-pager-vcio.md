# vCIO — One-Page SOP

> **Role mission:** Own the customer post-handoff. Drive discovery, onboarding, QBRs, and the strategic roadmap. *Aligned to portal v3.2.1.*

## You own
- Every customer in your portfolio from PRE_ENGAGEMENT → STEADY_STATE
- Discovery assessments (Site Survey, NIST CSF, NIST 800-171, AI Readiness)
- Onboarding task completion + phase progression
- QBR scheduling, delivery, and the rolling strategic roadmap

## You cannot
- Create or own sales leads · Approve pricing · Initiate handoffs (those flip at acceptance)

---

## Daily rhythm

1. **Open `/`** (vCIO Home)
2. **At-risk accounts first** — anyone stuck > 30 days needs a call today
3. **`/accounts`** — walk customers in ONBOARD phase. Update task statuses
4. **QBRs/14d rail** — any QBR in the next 14 days needs scheduling confirmation + agenda draft
5. **Discovery results from the past week** — flag high-severity findings for the COO

---

## The five onboarding phases

| Phase | Days | Your job |
|---|---|---|
| PRE_ENGAGEMENT | 0–7 | Welcome call, MSA filed, kickoff locked |
| DISCOVERY | 7–21 | Re-run Site Survey as customer (not prospect), gap analysis |
| ONBOARD | 14–60 | Agent rollout, RMM deploy, backup config, identity migration |
| STABILIZE | 30–60 | Tickets normalize, monitoring tuned, runbooks written |
| STEADY_STATE | ongoing | Normal MSP cadence + quarterly QBRs |

> Each phase auto-advances when all required tasks finish. Manual override available if you need to jump ahead.

---

## Working the customer page

`/accounts/[id]` is your home base. Six tabs:

| Tab | What you do |
|---|---|
| **Onboarding** | Phase progress bar · ownership strip (who has open tasks) · per-phase accordions · "Add ad-hoc task" pill · Print checklist |
| **Discovery** | Start / continue / re-run any of the 4 assessments. History list below |
| **Inventory** | Sites, identity, endpoints, backups, security stack, compliance |
| **QBRs** | Schedule next QBR · view history · mark completed |
| **Documents** | Upload signed MSA/SOW/BAA/NDA/DPA + amendments. Status badges flag expirations |
| **Roadmap** | Open the strategic roadmap (separate page) — the deliverable from every QBR |

---

## Discovery — which assessment when

| Assessment | When to run |
|---|---|
| **MSP Site Survey** | Always. Within 21 days of acceptance |
| **NIST CSF 2.0** | Any customer with compliance obligations (HIPAA, PCI, generic security maturity) |
| **NIST 800-171 / CMMC** | Federal contracting customers — required for CMMC L2/L3 readiness |
| **AI Readiness** | Customers leaning into AI advisory or already using AI tools |

Re-run annually for compliance customers. The portal carries history so trend lines stay visible.

---

## QBR cadence

1. Schedule at `/accounts/[id]` → QBRs tab → datetime picker. Portal creates the associated task in the onboarding plan
2. Build the deck (data from the customer's discovery + inventory + open tickets)
3. Run the meeting. Update the **Strategic Roadmap** at `/accounts/[id]/roadmap` afterwards
4. Mark QBR **completed** — history shows it with a green Badge
5. Spotted expansion? Drop a Note tagging the original salesperson — they create the new lead

---

## Portal paths you live in

| Where | What for |
|---|---|
| `/` | vCIO Home — KPIs, at-risk accounts, recent activity, upcoming QBRs |
| `/accounts` | Your customer portfolio, sorted by health |
| `/accounts/[id]` | Single customer — six tabs (above) |
| `/accounts/[id]/onboarding/print` | Print-friendly checklist for the binder |
| `/accounts/[id]/roadmap` | Strategic roadmap (QBR deliverable) |
| `/my-tasks` | Tasks you've been assigned across all customers |
| `/notifications` | Discovery completions, handoffs landing on you, mentions |

---

## Paper kit you keep
- [ ] Per-customer onboarding binder (signed MSA + SOW on top)
- [ ] Printed onboarding checklist (from `/accounts/[id]/onboarding/print`)
- [ ] Discovery results carried forward from sales
- [ ] QBR scheduling sheet (4 slots/year)
- [ ] Strategic roadmap printout, refreshed each QBR
- [ ] State-of-the-relationship 1-page memo (post-QBR)

---

## Quick rules

- **A QBR scheduled is not a QBR delivered.** The completed flag matters for the at-risk algorithm.
- **No customer should sit in ONBOARD > 60 days.** If they do, escalate to the COO with the blocker named.
- **Every signed doc → Documents tab + signed date.** Expirations only catch you if the date is in the system.
- **Verbal scope changes get a Note + a Documents amendment.** Anything you don't write down vanishes between QBRs.
- **Compliance findings → flag the COO same day.** Don't let a high-severity gap sit in your queue.
