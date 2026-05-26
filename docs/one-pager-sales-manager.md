# Sales Manager — One-Page SOP

> **Role mission:** Run the sales org. Reps, teams, territories, lead assignment, 5–20% pricing approvals. *Aligned to portal v3.2.1.*

## You own
- Every rep's pipeline and performance
- Team + territory definitions and routing
- 5–20% off-MRR pricing approvals
- Lead assignment + reassignment when reps leave or shuffle

## You cannot
- Approve 20%+ off MRR (COO) · Edit the MSP brand profile (Superadmin) · Edit the pricing catalog above your own approval tier

---

## Daily rhythm

1. **Open `/`** (Sales Manager Home)
2. **Pending approvals first** — clear every 5–20% bucket request before noon
3. **Team pipeline scoreboard** — anything in PROPOSAL > 14 days, coach the rep today
4. **`/sales/assign`** — any unassigned leads? Route them now
5. **Top-reps leaderboard** — click into anyone showing a slowdown and open their lead book
6. **Weekly:** `/sales/reps` — confirm no inactive accounts, last sign-in for everyone within 7 days

---

## The four management surfaces

| Surface | What you do there |
|---|---|
| `/sales/reps` | Hire new reps. Click any row → rep detail with KPIs, lead book, activity feed, deactivate, **bulk reassign all open leads** |
| `/sales/teams` | Create teams scoped by service line. Click into a team → edit, add/remove members, **toggle primary team**, archive |
| `/sales/territories` | Draw territories (states / zip / city / polygon). Each lead auto-routes by address |
| `/sales/assign` | Workbench for unassigned or mis-routed leads — filter, multi-select, reassign |

> Rep names + team chips everywhere on the portal click straight through to the management page. Top-reps leaderboard rows go to `/sales/reps/[id]`.

---

## Pricing approval — your tier

| Discount | Your move |
|---|---|
| 0–5% | Rep's own discretion — no action |
| **5–20%** | **You decide.** `/notifications` → review context → Approve or Reject with reason |
| 20%+ / below floor | Auto-routes to COO. You'll still see it land on your dashboard for awareness |

> Reject with a written reason every time. Reps need the why so the next pricing request lands closer to floor.

---

## When a rep leaves (or you're rebalancing)

1. Open `/sales/reps/[id]` for the outgoing rep
2. Click **Reassign leads** → pick the destination rep
3. Closed-won + closed-lost + nurture **stay with the original rep** for commission history
4. All active-pipeline leads move. Each move writes its own audit row
5. Then **Deactivate** the outgoing rep — they lose portal access immediately

---

## Team + territory rules

- A **team** can be generalist (no service lines) or scoped (e.g. "IT Team" = MANAGED_IT + CYBERSECURITY)
- A **territory** belongs to one team and matches by states **OR** zip codes **OR** cities **OR** a drawn polygon — any match assigns the lead
- A **rep** can belong to multiple teams; exactly one can be **primary** (the default landing-team for their list view)
- Toggle primary inline from the team page member row, or from the rep's detail page

---

## Portal paths you live in

| Where | What for |
|---|---|
| `/` | Sales Manager Home — approvals queue, team scoreboard, top reps, recent activity, "Manage your org" rail |
| `/sales` | Sales hub — KPI tiles to each management surface + approvals queue + top reps |
| `/sales/reps` | Roster of every salesperson |
| `/sales/reps/[id]` | Single rep: KPIs, teams, lead book, activity, **reassign + deactivate** |
| `/sales/teams/[id]` | Team editor + members + territories |
| `/sales/territories` | Territory list + create |
| `/sales/assign` | Unassigned-lead workbench |
| `/pipeline` | Whole-team kanban |
| `/admin/audit` | Every change in the portal with diffs |
| `/admin/pricing` | Edit the catalog — bundles, standalone, per-unit, advanced JSON |

---

## Quick rules

- **Approvals are your inbox-zero target.** A rep waiting on you is a deal cooling off.
- **No primary-team rep should ever be on zero teams.** Use the warn badge on RepsList as your tripwire.
- **Reassign before deactivating.** Deactivating a rep with active leads orphans them.
- **Every territory needs at least one team member.** Otherwise the lead routes to a black hole.
- **Print the bundles tab quarterly** after any pricing change and keep the paper kit current.
