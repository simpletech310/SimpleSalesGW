# COO — One-Page SOP

> **Role mission:** Ops oversight. Accept all handoffs. Approve 20%+ off MRR. Watch the audit log. *Aligned to portal v3.2.1.*

## You own
- Every handoff from Sales to Ops — accept or reject
- 20%+ off-MRR + below-floor pricing approvals
- Audit-log review and anomaly detection
- Customer oversight across the whole book (not just one vCIO's portfolio)

## You cannot
- Edit the pricing catalog (Sales Manager + Superadmin) · Edit the MSP brand profile (Superadmin)

---

## Daily rhythm

1. **Open `/`** (COO Home)
2. **Handoff queue first** — anything waiting > 24 hours, decide today
3. **Pricing-approval rail** — clear COO-tier asks (20%+ off MRR or below-floor)
4. **Late-stage deals** — anything in NEGOTIATION > 21 days, ping the Sales Manager
5. **Weekly:** `/admin/audit` skim — unusual export activity or rejection clusters get investigated

---

## Handoff acceptance — the moment that matters

Open `/notifications` → **Handoffs awaiting acceptance**. For each one:

1. Read the lead summary + discovery + final pricing
2. Check the **Handoff QC** AI flags — anything the rep promised that's out-of-scope?
3. Verify: start date, cutover plan, decision-maker contact, technical contact, sites + access notes, compliance commitments
4. Decide:
   - **Accept** → portal creates the Customer row, copies lead data, generates onboarding tasks from the bundle template, assigns to the default vCIO
   - **Reject** → write the reason. Packet bounces back to the salesperson on their `/notifications`

> Reject decisively. A vague handoff becomes a vague onboarding becomes a churn risk.

---

## Pricing approval — your tier

| Discount | Your move |
|---|---|
| 0–5% | Rep's own |
| 5–20% | Sales Manager — you only see for awareness |
| **20%+ or below floor** | **You.** Open `/notifications` → review rep's justification + lead context → Approve / Reject with reason |

> Below-floor + 5–20% range = still routes to you (deterministic). Don't ask the Sales Manager to approve it.

---

## Weekly throughput watch

The COO Home shows you:
- **Recent handoff decisions** — last 7 days, accepted vs rejected with timestamps + actor
- **Weekly approval throughput** — count + median turnaround hours
- **Late-stage deals** — anything in PROPOSAL/NEGOTIATION > 21 days

Use the median turnaround as your service-level barometer. > 24 hours and the sales team starts losing momentum.

---

## Customer oversight

You see every customer across every vCIO. Use this for:
- **Capacity check** — is one vCIO sitting on too many active onboardings?
- **At-risk escalation** — vCIOs flag you on stuck onboardings; you decide whether to add capacity or reset scope with the customer
- **Compliance escalations** — high-severity NIST findings come straight to you

---

## Portal paths you live in

| Where | What for |
|---|---|
| `/` | COO Home — handoff queue, pricing approvals, late-stage deals, weekly throughput |
| `/notifications` | Approvals + handoffs awaiting you |
| `/accounts` | Every customer, every vCIO's portfolio |
| `/pipeline` | Whole-org pipeline visibility |
| `/admin/audit` | Every change in the portal — actor, timestamp, before/after diff. **Export CSV** for compliance audits |
| `/admin/ai-usage` | MTD AI spend + per-feature breakdown |

---

## Audit log — what to look for

Weekly skim. Flag and investigate:
- **EXPORT** spikes — someone pulling unusual volumes of lead data
- **DELETE** activity outside business hours
- **REJECT** clusters from one rep — coaching opportunity or process problem
- **LOGIN** from new locations / IPs (the portal logs `userAgent` + IP on every action)

Filter by entity, actor, or freetext at top of the page.

---

## Quick rules

- **Handoff inbox-zero is your discipline.** Anything > 48 hours undermines the rep's customer relationship.
- **Always write the reject reason.** Salespeople need the why so they can fix it.
- **20%+ approvals get a written justification in the approval comment.** Future-you reading the audit log will thank you.
- **No customer creation outside the handoff flow.** If you spot an orphan, run the `/admin/setup` → "Recover orphaned accounts" tool. Don't hand-create.
- **Audit log retention is forever.** Treat it as the legal record.
