# Standard Operating Procedure — End-to-End Sales

> **Version:** 1.0 · aligned to portal v3.2.1
> **Audience:** Everyone who touches a deal — Salespeople, Sales Managers, vCIOs, the COO, Superadmins, and anyone covering for them.
> **Scope:** From the first prospect note on a paper card all the way to a customer in steady-state onboarding. Covers the **paper binder/checklist process** and the **GateWay TelNet Sales Portal** side-by-side, so the work is identical whether you're at a coffee shop with a notebook or at your desk.

---

## Table of contents

1. [Roles & accountability](#roles--accountability)
2. [The pipeline at a glance](#the-pipeline-at-a-glance)
3. [Paper kit & portal access checklist](#paper-kit--portal-access-checklist)
4. [Phase 0 — Prospect → Lead](#phase-0--prospect--lead)
5. [Phase 1 — Qualify the lead](#phase-1--qualify-the-lead)
6. [Phase 2 — Discovery](#phase-2--discovery)
7. [Phase 3 — Pricing & approvals](#phase-3--pricing--approvals)
8. [Phase 4 — Proposal & negotiation](#phase-4--proposal--negotiation)
9. [Phase 5 — Close-won → Handoff to Ops](#phase-5--close-won--handoff-to-ops)
10. [Phase 6 — Onboarding & QBR cadence](#phase-6--onboarding--qbr-cadence)
11. [Phase 7 — Steady state & expansion](#phase-7--steady-state--expansion)
12. [Cross-cutting: pricing, audit, AI, and exports](#cross-cutting-pricing-audit-ai-and-exports)
13. [Role appendix — what each role does on a normal day](#role-appendix--what-each-role-does-on-a-normal-day)
14. [Glossary](#glossary)

---

## Roles & accountability

| Role | Owns | Sees | Cannot do |
|---|---|---|---|
| **SALESPERSON** | Own leads from prospect → close-won. Initiate handoffs. | Their own leads + pipeline. Pricing sticker (not floor). | View other reps' leads, approve own pricing below floor, see customer detail beyond the original lead. |
| **SALES_MANAGER** | The whole sales org — reps, teams, territories, lead assignment, 5–20% pricing approvals. | Every lead, every rep, full pricing including floor, customer list. | Approve 20%+ off MRR (COO only). Edit MSP brand profile or system config (SUPERADMIN). |
| **VCIO** | Customers post-handoff — discovery, onboarding, QBRs, strategic roadmap. | Customer book + their portfolio. Read-only access to source leads. | Run the sales pipeline (cannot create leads or approve pricing). |
| **COO** | Operations oversight. Accept all handoffs. Approve 20%+ off MRR. Audit log. | Everything except system config + brand profile. | Edit pricing catalog (Sales Manager + Superadmin only). |
| **SUPERADMIN** | The platform itself — users, roles, integrations, pricing catalog, MSP brand profile, AI budget. | Everything. | Nothing technical. Operationally still defers to COO for handoffs. |

> **Rule of thumb:** if you find yourself wanting to do something a role above doesn't allow, that's the system protecting an audit trail. Ask the right role, don't share credentials.

---

## The pipeline at a glance

```
PROSPECT  ──►  LEAD  ──►  QUALIFIED  ──►  DISCOVERY  ──►  PRE_SALES  ──►  PROPOSAL  ──►  NEGOTIATION  ──►  CLOSED_WON  ──►  HANDOFF  ──►  ONBOARDING  ──►  STEADY_STATE
                                                                                                      └►  CLOSED_LOST  or  NURTURE
```

| Portal stage | What it means | Who's driving | Typical days in stage |
|---|---|---|---|
| LEAD | First touch logged | Salesperson | 0–7 |
| QUALIFIED | DQ score ≥ threshold, real opportunity | Salesperson | 1–14 |
| DISCOVERY | Site survey / assessment running | Salesperson + vCIO if compliance-heavy | 5–30 |
| PRE_SALES | Quote being built, no formal proposal yet | Salesperson | 1–14 |
| PROPOSAL | Quote delivered to prospect | Salesperson | 3–21 |
| NEGOTIATION | Pricing or scope back-and-forth | Salesperson + Sales Manager if discount requested | 1–14 |
| CLOSED_WON | Verbal or signed yes | Salesperson | < 1 |
| CLOSED_LOST | Walked away — log reason | Salesperson | < 1 |
| NURTURE | Not now, check back later | Salesperson | indefinite |

---

## Paper kit & portal access checklist

Before any rep starts a workweek, they should have **both** sides ready.

### Paper kit (in a binder or folder)
- [ ] **Prospect intake card** (1 per prospect) — see [Phase 0](#phase-0--prospect--lead) for fields
- [ ] **Discovery worksheet** — MSP Site Survey, NIST CSF, NIST 800-171, AI Readiness (whichever applies)
- [ ] **Pricing scratchpad** — bundle MRR + seat tiers + floor printout from `/admin/pricing` Bundles tab
- [ ] **Objection library printout** — current snapshot of `/admin/objections`
- [ ] **Outreach template printout** — current `/admin/outreach` templates with placeholders highlighted
- [ ] **Handoff checklist** — Customer Information Form (MSA + SOW prerequisites)
- [ ] **Business cards + signed-MSA samples**

### Portal access
- [ ] Active user account at the right role
- [ ] Magic-link delivery tested (Sign out → sign back in via magic-link tab)
- [ ] Sidebar shows: Home, My tasks, Notifications, Pipeline group, Account group, Sign out
- [ ] Notification bell is reachable (top-right)
- [ ] (Sales Manager only) `/sales` hub is the second item under "Manage"

---

## Phase 0 — Prospect → Lead

**Goal:** turn a name on a list into a tracked, scored Lead with a real owner.

### Paper version

1. **Salesperson** fills the **Prospect intake card** in pen at the source (event, referral, drive-by):
   - Business name (DBA if different)
   - Address (street, city, state, zip — required for territory routing)
   - Industry (Medical, Legal, Manufacturing, etc.)
   - Approximate seat count
   - Primary contact: name, title, email, phone
   - Executive sponsor: name, title
   - Source (referral, inbound web, cold-walk, event)
   - Deal kind hint (Managed-IT bundle, Voice, CCTV, Access control, NIST assessment)
   - Compliance drivers if known (HIPAA, PCI, CMMC, etc.)
   - Current MSP + sentiment (none / unhappy / neutral / happy)
   - Cyber-insurance renewal date if mentioned
   - Initial notes

2. **Salesperson** drops the card in the **"To enter"** tray at the end of the day.

3. **Sales Manager** scans the tray once a day to make sure nothing is sitting more than 48 hours.

### Portal version

1. Sign in. Sidebar → **New** (or Home → "+ New lead" button).
2. Fill the lead form. Required fields are marked with a red asterisk; everything else makes scoring + AI summaries better:
   - Business name, address (street/city/state/zip), industry, seats, deal kind
   - Primary contact + executive sponsor blocks
   - Compliance drivers (multi-select)
   - Current MSP name + satisfaction
3. **Submit**. The portal will:
   - Geocode the address (powers `/leads/map` and territory matching)
   - Auto-assign the lead to the right **Team + Territory** based on address
   - Run the deal-quality scoring engine → Services / Customer / Deal Quality scores
   - Drop a **Research summary** stub the AI fills in within a minute
4. You're now on `/leads/[id]`. Stage = `LEAD`. Owner = you.

### Sales Manager intercept
- Open `/sales/assign` if a lead came in unassigned (no address, no territory match). Sticky toolbar lets you filter by territory + team, then drag/assign to a specific rep.
- If a paper card was entered for someone who already has another lead in flight at the same company, use the search on `/leads` to dedupe before creating.

### Audit trail
The portal writes a `CREATE` audit row on every lead. The Sales Manager and COO can review at `/admin/audit` (Sales Manager via Manage menu).

---

## Phase 1 — Qualify the lead

**Goal:** decide if this is worth working. If yes, move to `QUALIFIED`. If no, mark `CLOSED_LOST` or `NURTURE` with a reason.

### Paper version

1. **Salesperson** reaches out using the printed outreach templates. Log every touch on the back of the prospect card:
   - Date, channel (call / email / LinkedIn / in-person)
   - Outcome (no answer / left voicemail / replied / meeting set)
   - Next action + due date
2. After the first real conversation, score the deal yourself:
   - Pain real? Seats accurate? Budget signal? Decision-maker engaged?
3. If qualified, mark **"QUALIFY"** on the card and hand to the Sales Manager for sign-off (Sales Manager initials + date).

### Portal version

1. On `/leads/[id]`, click **Outreach** to compose using a template. Placeholders auto-fill from the lead.
2. Every touch logged from the **Activity** tab (call / email / meeting / note). Use **Next action** + **Due date** — this populates your `/my-tasks` and the "This week" rail on Home.
3. Update the **Pipeline stage** dropdown to `QUALIFIED` when the criteria are met.
4. **Sales Manager** does not need to approve a stage move from LEAD → QUALIFIED — the audit log captures it.

### Cold lead handling
- If the prospect goes dark for 14+ days during outreach, the deal will appear on your **Going stale** rail on Home. Decide:
  - Push again with a different channel
  - Move to `NURTURE` (long-term touchpoints)
  - `CLOSED_LOST` with a written reason — required for the close

---

## Phase 2 — Discovery

**Goal:** know what you're selling into. Scope it accurately so pricing is honest.

### Paper version

1. **Salesperson** schedules a site visit or screen-share. Brings the right worksheet:
   - **MSP Site Survey** — sites, identity provider, endpoints, backups, security stack, compliance obligations
   - **NIST CSF 2.0** worksheet (Tier 1–4 per Subcategory) if compliance is in scope
   - **NIST 800-171 / CMMC** if Federal Contracting
   - **AI Readiness** scorecard if AI Advisory is in scope
   - **Voice Pre-Sale** / **CCTV Pre-Sale** / **Access Control Pre-Sale** worksheets for non-MSP deals
2. Capture answers in pen. Walk every floor, count every door / camera / drop / extension. Don't trust verbal counts.
3. Photograph rack rooms, the IDF, the entry/exit doors, any cabling pain points.
4. Back at the desk, **transcribe to the portal within 24 hours**.

### Portal version

1. On the lead's `/leads/[id]` page → **Discovery** tab.
2. Pick the assessment kind (Site Survey is the default for managed IT).
3. Walk the form. Each section saves to the database on blur — you can pause mid-survey and come back. Sections support file attachments (photos, network diagrams).
4. When done, mark the assessment **COMPLETED**. The portal will:
   - Write an `UPDATE` audit row
   - Make the data available on the lead's right-hand insights rail
   - Re-score the deal (more data → higher confidence → potentially a stage hint)
5. (Compliance-heavy deals) Tag the **vCIO** on the lead via the Notes tab so they can shadow the NIST sections.

### Sales Manager / vCIO role here
- **vCIO** can be added as a reviewer on compliance-driven deals. They get the discovery in their queue once it's submitted.
- **Sales Manager** can override the auto-score from the deal-quality card if the data is incomplete but the deal is obviously strong (e.g. warm referral from existing customer).

---

## Phase 3 — Pricing & approvals

**Goal:** produce a defensible price that's at or above floor — and if not, get an approver before promising anything.

### Pricing components (paper printout from `/admin/pricing` Bundles tab)

For each bundle (Essential, Professional, Compliance+, Enterprise, Custom):
- Per-seat MRR tiers (e.g. 1–24 seats = $X / seat, 25–99 = $Y, 100+ = $Z)
- Per-seat **floor** (anything below this = below-floor, needs COO approval)
- Onboarding base + per-seat
- Annual add-ons (NIST CSF assessment, etc.)
- Includes (what service lines + sub-tiers are bundled)

For per-unit lines (voice extensions, cable drops, doors, cameras, NVR, labor):
- Per-unit MRR + per-unit one-time
- See `/admin/pricing` Per-unit (reference) tab

### Paper version

1. **Salesperson** picks the bundle that matches discovery.
2. Multiply seats × tier MRR. Add onboarding. Add any per-unit lines. Add annual add-ons.
3. Write the proposed price + discount-off-sticker on the **Pricing scratchpad** page of the prospect's file.
4. If the proposed MRR is:
   - **At or above sticker:** no approval needed. Proceed.
   - **0–5% off sticker:** Salesperson's own discretion. Note the reason on the scratchpad.
   - **5–20% off MRR:** **Sales Manager approval required.** Sales Manager initials the scratchpad + writes their decision.
   - **20%+ off MRR or below floor:** **COO approval required.** Sales Manager initials *and* COO countersigns.

### Portal version

1. On `/leads/[id]` → **Pricing** tab → click into the **PricingCard**.
2. The card auto-fills from the seat count + deal kind + discovery data. If something's wrong, edit the inputs (seats, bundle, line items).
3. Adjust the proposed MRR or per-line price. The card live-calculates:
   - % off sticker
   - % off floor (red if below floor)
   - Approval tier required (none / MANAGER / COO)
4. Click **Request approval** when the price needs sign-off.
   - The request hits `/notifications` for the right approver
   - Sales Manager sees the queue on `/sales` ("Pending pricing approvals")
   - COO sees the queue on their Home + `/notifications`
5. Approver clicks through, reviews the rep's note + the lead context, then **Approve** or **Reject** with a reason.
6. On approve, the price locks. The portal records who approved + when in the audit log.

> **Below-floor + 5–20% range conflict:** if the proposed MRR is in the 5–20% range *but* below floor, it auto-routes to COO. Don't try to game this — the routing is deterministic.

---

## Phase 4 — Proposal & negotiation

**Goal:** put a written quote in front of the prospect, navigate objections, get to verbal yes.

### Paper version

1. **Salesperson** drafts the proposal in your usual letterhead doc (Word/Pages/Google Docs). Pull the approved price from the Pricing scratchpad.
2. Cross-reference the printed **objection library** while writing — pre-empt the top 3 likely objections for the industry.
3. Print, sign, hand-deliver or mail.
4. Log the delivery on the back of the prospect card. Schedule the follow-up.
5. During negotiation: every concession is written + dated on the scratchpad. Anything that changes price re-enters [Phase 3](#phase-3--pricing--approvals).

### Portal version

1. On `/leads/[id]` → click **Generate proposal** (uses the approved pricing card + customer info + selected outreach template).
2. Edit the generated draft. The portal renders a clean PDF preview.
3. Send via the **Outreach** tab using a Proposal-category template, attaching the PDF, or download + send through your normal channel.
4. Move the stage dropdown to `PROPOSAL`. Then `NEGOTIATION` if the prospect comes back with counters.
5. **Objection coach** is one click away in the right-hand rail on the lead — it pulls from `/admin/objections` filtered to the lead's industry and offers rebuttals.
6. Every back-and-forth gets a new Activity entry. **Do not edit old activities** — add new ones so the timeline is honest.

### Sales Manager visibility
- The Sales Manager home dashboard surfaces deals in PROPOSAL/NEGOTIATION via the team pipeline scoreboard. They'll coach proactively if a deal sits in NEGOTIATION more than 14 days.

---

## Phase 5 — Close-won → Handoff to Ops

**Goal:** convert a verbal yes into a signed MSA + a clean handoff to the COO so onboarding can start without scope ambiguity.

### Paper version

1. **Salesperson** captures the verbal yes on the prospect card with the date + who said it (their name + title).
2. Send the standard **MSA + SOW** package (signed by you / countersigned by them). Use the firm's templated docs.
3. Once countersigned, fill out the **Handoff packet**:
   - Final agreed price + bundle + add-ons + per-unit lines
   - Onboarding start date the customer wants
   - Decision-maker + day-to-day contact + technical contact
   - Sites + addresses + access notes
   - Existing MSP cutover plan (if any) — required date for cutover
   - Compliance commitments made (NIST assessment by date X, etc.)
   - Any verbal promises that aren't in the MSA — these go on the **Handoff QC** sheet
4. Hand the packet to the **COO**. They review. If complete, COO signs the acceptance line. If incomplete, packet comes back to the rep with what's missing circled in red.

### Portal version

1. On `/leads/[id]` → set stage to `CLOSED_WON` → fill the **Actual close date** + **Final agreed terms** prompt.
2. Click **Initiate handoff**. The portal walks you through a structured form:
   - Auto-fills everything it knows from the lead + pricing card + discovery
   - Asks you to confirm the things only you know (start date, cutover, verbal commitments)
   - Runs **Handoff QC** through the AI — it flags any verbal promise that conflicts with the MSP profile's out-of-scope list
3. Click **Submit handoff**. Status = `INITIATED`. The COO is notified.
4. **COO** opens `/notifications` → **Handoffs awaiting acceptance**. Reviews the packet. Either:
   - **Accept** → the portal creates the `Customer` row, copies the lead data, generates the onboarding task template based on bundle + service lines, and assigns the customer to the default vCIO. The handoff is now `ACCEPTED`.
   - **Reject** → write the reason. The handoff bounces back to the salesperson on `/notifications`. Fix the gaps and resubmit.

### What changes after acceptance
- The lead stays in the system (read-only, for commission + history).
- A new `Customer` record appears at `/accounts/[id]` with phase = `PRE_ENGAGEMENT`.
- The vCIO gets the customer on their `/accounts` list.
- Salesperson loses write access to the customer side; they keep their lead.

### Recovery if a handoff somehow doesn't produce a Customer
- **SUPERADMIN** opens `/admin/setup` → "Recover orphaned accounts" → runs the backfill. Idempotent.

---

## Phase 6 — Onboarding & QBR cadence

**Goal:** move the customer from PRE_ENGAGEMENT → STEADY_STATE without losing momentum or scope creep.

### The five onboarding phases (portal field: `currentPhase`)

| Phase | What's happening | Typical duration |
|---|---|---|
| `PRE_ENGAGEMENT` | Welcome call scheduled, MSA filed, kickoff date locked | 0–7 days |
| `DISCOVERY` | Site survey re-run as customer (not prospect), gap analysis | 7–21 days |
| `ONBOARD` | Agent rollout, RMM deployment, backup config, identity migration | 14–60 days |
| `STABILIZE` | Tickets normalize, monitoring tuned, runbooks documented | 30–60 days |
| `STEADY_STATE` | Normal MSP cadence | indefinite |

### Paper version

1. **vCIO** keeps a per-customer onboarding binder. Inside:
   - Signed MSA + SOW (top of binder)
   - The full **Onboarding checklist** for the bundle they bought (printed off `/accounts/[id]/onboarding/print`)
   - Discovery results from sales (carried over) + any new customer-side discovery
   - QBR scheduling sheet (4 QBR slots per year, dates penciled in)
   - Strategic roadmap printout updated each QBR
2. Each task in the checklist is owned by a role (PRE_SALES tasks → Sales, DISCOVERY → vCIO + Salesperson, ONBOARD → vCIO + Ops, etc.). The vCIO physically initials each task when complete.
3. QBRs happen quarterly — vCIO sets the date, books the room, prints the QBR deck from the portal.

### Portal version

1. **vCIO** opens `/accounts/[id]` → **Onboarding** tab.
2. Top of the panel shows the **task ownership strip** — who has how many open tasks. Use this to spot gaps fast.
3. Below that is the **5-phase progress bar**.
4. Each phase is an accordion. Inside:
   - Task title + description
   - Status dropdown (PENDING / IN_PROGRESS / DONE / SKIPPED / BLOCKED)
   - Due date (date input)
   - Owner (auto-set by role default, can be overridden from `/accounts/[id]/onboarding`)
5. Mark tasks as you complete them. The portal computes phase % and auto-advances the customer's `currentPhase` when all required tasks in a phase finish.
6. Need an ad-hoc task? "Add ad-hoc task" pill under the toolbar.
7. Want a paper copy for the customer's binder? "Print checklist" link top-right of the tab.

### Discovery (post-handoff)
- vCIO can re-run any of the four assessments on the customer (`/accounts/[id]` → Discovery tab):
  - MSP Site Survey
  - NIST CSF 2.0
  - NIST 800-171 / CMMC
  - AI Readiness

### QBRs
1. **vCIO** schedules quarterly via `/accounts/[id]` → **QBRs** tab → datetime picker.
2. Portal auto-creates a QBR task in the customer's onboarding plan.
3. After the meeting, mark the QBR `completed` — the portal shows it in the QBR history with a "completed" Badge.
4. The Strategic Roadmap (`/accounts/[id]/roadmap`) is the deliverable from the QBR. Update it each quarter.

### Documents
- All signed docs (MSA, SOW, BAA, NDA, DPA, amendments) live on the customer's **Documents** tab.
- Upload via the form → mark **Signed** with name + date → portal tracks expirations and badges expired docs in red.

---

## Phase 7 — Steady state & expansion

**Goal:** keep the customer healthy and find expansion opportunities at every QBR.

### Paper version

1. Quarterly QBR (see Phase 6).
2. Annually: NIST CSF re-assessment for compliance customers, AI Readiness re-score for forward-leaning customers.
3. After every QBR: vCIO writes a 1-page **State of the relationship** memo. Goes in the customer binder.
4. Expansion lead spotted? Flip a fresh **Prospect intake card** for the new service line and hand to the original salesperson — re-enter at [Phase 0](#phase-0--prospect--lead).

### Portal version

1. The portal surfaces **At-risk accounts** on the vCIO Home — customers with stuck onboarding > 30 days OR no QBR in 90+ days.
2. **COO** sees pricing-approval queue, weekly handoff throughput, and recent handoff decisions on the COO Home.
3. **Sales Manager** sees the team pipeline + closed-won-MTD + approvals queue on their Home.
4. To start an **expansion deal**: on the customer's account page, the vCIO opens a Notes entry tagging the original salesperson. The salesperson then creates a **new lead** referencing the customer in the notes. Pricing routes the same way as a new deal.

---

## Cross-cutting: pricing, audit, AI, and exports

### Pricing catalog (SUPERADMIN + SALES_MANAGER)
- `/admin/pricing` — full editor. Four tabs: Bundles, Standalone lines, Per-unit (reference), Advanced JSON.
- Changes save to `SystemConfig.pricing.catalog` and propagate **instantly** to every PricingCard.
- Always edit by tabs first. Only use Advanced JSON if pasting a known-good backup.
- Print the **Bundles** tab after every change and circulate so the paper kit stays current.

### Audit log (SALES_MANAGER, COO, SUPERADMIN)
- `/admin/audit` — every CREATE / UPDATE / DELETE / APPROVE / REJECT / LOGIN / EXPORT is logged with actor, timestamp, before/after diff.
- Filter by entity, actor, or freetext.
- Export CSV button for compliance audits.

### AI usage + budget (SUPERADMIN + COO)
- `/admin/ai-usage` — MTD spend, calls per feature, top features, recent calls.
- Caps set in `/admin/config`. Per-lead cap stops a single deal from blowing the budget; org cap protects the month.
- If you see "AI budget exceeded" toasts: a Superadmin needs to bump the cap or wait for the new month.

### Exports (SALES_MANAGER, COO)
- Most list pages have an **Export CSV** button in the toolbar.
- Audit log export available for compliance asks.

### MSP brand profile (SUPERADMIN)
- `/admin/msp-profile` — Identity, Services, Markets, Win stories, Preview, Advanced JSON.
- This is the system-prompt preamble Claude sees on **every** AI call (research summaries, objection coach, outreach personalize, handoff QC, etc.).
- Tone of voice + services emphasis + win stories live here. Treat it as the single source of truth for "how the company talks."

---

## Role appendix — what each role does on a normal day

### Salesperson — daily rhythm
1. Open `/` (Salesperson Home). Scan: This-week's next-actions, Going-stale rail, Top opportunities.
2. Work the day's calls / emails. Log every touch via the lead's Activity tab.
3. End of day: any new prospects → create leads in portal (transcribe paper cards).
4. Before signing off: anything stale > 7 days gets a decision (push / nurture / lost).

### Sales Manager — daily rhythm
1. Open `/` (Sales Manager Home). Pending approvals queue first — anything in the 5–20% bucket is your tier; clear it.
2. Check the team pipeline scoreboard. Anything that's been in PROPOSAL > 14 days, coach the rep.
3. `/sales/assign` → any unassigned leads? Route them.
4. Top-reps leaderboard → click into any rep showing a slowdown, open their lead book.
5. Weekly: `/sales/reps` — confirm no inactive accounts, last-sign-in for everyone within 7 days.

### vCIO — daily rhythm
1. Open `/` (vCIO Home). At-risk accounts first. Anyone stuck > 30 days needs a call today.
2. `/accounts` → walk customers in `ONBOARD` phase. Update task statuses.
3. Check QBRs/14d rail — any QBR in the next 14 days needs a scheduling confirmation + agenda draft.
4. Discovery results from the past week → flag any high-severity findings for the COO.

### COO — daily rhythm
1. Open `/` (COO Home). Handoff queue first — anything waiting > 24 hours, decide.
2. Pricing-approval rail — clear COO-tier asks (20%+ off MRR or below-floor).
3. Late-stage deals — anything in NEGOTIATION > 21 days, ping the Sales Manager.
4. Weekly: `/admin/audit` skim. Any unusual export activity or rejection clusters get investigated.

### Superadmin — weekly rhythm
1. `/admin` → integration health row. Anything not green → fix or escalate.
2. `/admin/ai-usage` → if MTD spend > 70% of budget by mid-month, raise it or tighten the per-lead cap.
3. `/admin/users` → deactivate anyone who's left the company. Confirm role assignments are still right.
4. `/admin/setup` → run "Recover orphaned accounts" monthly as a safety check.
5. `/admin/msp-profile` → review with the COO quarterly. Win stories should always be < 12 months old.

---

## Glossary

| Term | Meaning |
|---|---|
| **DQ** | Deal Quality score (0–100). Composite of seat count, industry fit, compliance match, MSP-incumbent sentiment, urgency signals. |
| **Sticker** | List price for the chosen bundle + add-ons at the rep's seat tier, before any discount. |
| **Floor** | Minimum per-seat MRR the company will accept. Below floor = COO approval mandatory. |
| **Tier (approval)** | Which role can approve a given discount. NONE (rep's own discretion, ≤5%), MANAGER (5–20%), COO (20%+ or below floor). |
| **Handoff** | The formal sales-to-ops baton pass after CLOSED_WON. Reviewed by COO, accepted or rejected. |
| **Customer (vs Lead)** | A Lead becomes a Customer only after an accepted handoff. Customers are owned by vCIOs; Leads by Salespeople. |
| **vCIO** | Virtual CIO — the post-sale strategic advisor + onboarding driver for a customer. |
| **QBR** | Quarterly Business Review. The vCIO + customer cadence ritual. |
| **CSF / 800-171 / CMMC** | NIST cybersecurity frameworks. CSF 2.0 = general, 800-171 = controlled-unclassified info (CMMC L2/L3 readiness). |
| **Primary team** | A rep's default team — where their lead list lands when they sign in. Reps can belong to multiple teams; only one is primary. |
| **Service line** | A category of work (MANAGED_IT, CYBERSECURITY, VOIP, CABLING, ACCESS_CONTROL, VIDEO, NIST_ASSESSMENT, AI_ADVISORY, VCIO_RETAINER). Teams + territories filter on these. |
| **Stage** | Where a lead sits in the pipeline (LEAD → QUALIFIED → ... → CLOSED_WON). |
| **Phase** | Where a customer sits in onboarding (PRE_ENGAGEMENT → ... → STEADY_STATE). |

---

## Document control

- **Owner:** Sales Manager (operational changes) + Superadmin (portal changes)
- **Review cadence:** Quarterly with the COO. Whenever the pricing catalog or MSP brand profile changes substantively, reprint Appendix A (pricing) and the cover page (roles).
- **Last update:** aligned to portal v3.2.1 — covers the full Sales Manager toolkit (rep detail, bulk reassign, primary-team toggle, manage-org rail).
