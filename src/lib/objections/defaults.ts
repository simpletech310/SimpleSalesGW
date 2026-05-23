/**
 * Default seed objections + tested rebuttals — extracted from
 * 07-Sales-and-Operations/01_Sales_Playbook.md.
 *
 * Categories used:
 *   - PRICE     : cost / budget pushback
 *   - TIMING    : "not now" / urgency
 *   - AUTHORITY : "let me check with…" / decision-maker absent
 *   - INCUMBENT : existing-MSP / locked-in / contract
 *   - TRUST     : credibility / case studies / size
 *   - SCOPE     : "we only need X" / piecemeal asks
 *   - INTERNAL  : "we'll do it in-house"
 *   - COMPLIANCE: regulatory / industry-specific blockers
 */

import { Industry } from "@prisma/client";

export const OBJECTION_CATEGORIES = [
  "PRICE",
  "TIMING",
  "AUTHORITY",
  "INCUMBENT",
  "TRUST",
  "SCOPE",
  "INTERNAL",
  "COMPLIANCE",
] as const;

export type ObjectionCategory = (typeof OBJECTION_CATEGORIES)[number];

export const DEFAULT_OBJECTIONS: ReadonlyArray<{
  category: ObjectionCategory;
  industry?: Industry | null;
  trigger: string;
  rebuttal: string;
  source?: string;
}> = [
  // PRICE
  {
    category: "PRICE",
    trigger: "Your price is higher than what we're paying now.",
    rebuttal:
      "Fair. Most clients we win say the same in the first meeting. Let me show you what's covered today vs. what we'd include — usually we're replacing 3-4 separate vendors, plus the time you spend coordinating them. If we map line-for-line and we're still higher, you should absolutely stay where you are.",
    source: "Sales Playbook §Objections — Price",
  },
  {
    category: "PRICE",
    trigger: "We don't have budget for managed services this year.",
    rebuttal:
      "Got it. Two paths: (1) we can scope a smaller Foundation engagement that fits inside your current break-fix spend, or (2) we wait until your renewal cycle and revisit. Which would be more useful?",
  },
  {
    category: "PRICE",
    trigger: "Can you just match what they're charging?",
    rebuttal:
      "I'd rather earn it on value than discount on price. Let me show you the floor — that's what protects you from a vendor cutting corners on response time or SOC coverage in month 4. If we still need to be in the same number, I'd start there with what we'd take out.",
  },

  // TIMING
  {
    category: "TIMING",
    trigger: "Now's not the right time — call me in 6 months.",
    rebuttal:
      "Totally hear you. Two things I'd flag: (1) your cyber-insurance renewal is in [X] months and the questionnaire gets harder every cycle, and (2) the 0-30 day work we'd do now is mostly about safety, not transformation. Want me to send a 1-pager you can use as a checklist between now and then?",
  },
  {
    category: "TIMING",
    trigger: "We're in the middle of [project]. Can't take on more.",
    rebuttal:
      "Makes sense. The 0-30 day plan we'd run is parallel to what your team is doing — it's mostly background instrumentation and a documented baseline. Worth being a stage further when [project] ships, vs. starting from scratch in Q3?",
  },

  // AUTHORITY
  {
    category: "AUTHORITY",
    trigger: "I'd need to run this by [partner / board / CFO].",
    rebuttal:
      "Of course. Two things make that easier: (1) I'll send a 1-page exec summary tailored to what they care about, and (2) let me know if it'd help to have them on the next call so they can ask the hard questions directly. Who would you bring in?",
  },
  {
    category: "AUTHORITY",
    trigger: "I'm not the one who decides.",
    rebuttal:
      "Appreciate the honesty — saves us both time. Who is, and would it be appropriate to loop them in earlier than later so we don't recap everything twice?",
  },

  // INCUMBENT
  {
    category: "INCUMBENT",
    trigger: "We're under contract with [current MSP] for another N months.",
    rebuttal:
      "That's fine — we don't try to break contracts. We can scope a transition plan that lines up with that renewal date, or run a parallel assessment now so you have something to compare against when the renewal lands. Either preference?",
  },
  {
    category: "INCUMBENT",
    trigger: "Our current MSP is fine — we'd rather not switch.",
    rebuttal:
      "I respect that. Switching is real work. Two questions to make sure: (1) do they cover [the thing the assessment said is missing]? and (2) when's your next contract review? If you can answer 'yes' and the review is more than 12 months out, you're set. If either's a 'maybe,' worth a 30-minute readout.",
  },
  {
    category: "INCUMBENT",
    trigger: "We just changed providers six months ago.",
    rebuttal:
      "Got it — you don't want to re-platform anything. We're happy to do an independent NIST or Site Survey as a one-time engagement so you have an outside read on the new setup. No re-platform required.",
  },

  // TRUST
  {
    category: "TRUST",
    trigger: "How big is your team? You sound small for what we'd need.",
    rebuttal:
      "Fair question. We're [N] people, structured as pods — your account gets a vCIO, a project lead, and a tier-2 engineer named. We're not a 200-seat helpdesk farm; we trade scale for senior engineers per account. Happy to share two reference calls in your industry.",
  },
  {
    category: "TRUST",
    trigger: "Do you have case studies / references in our industry?",
    rebuttal:
      "Yes — let me send two with comparable size and compliance profile. The second one is happy to do a 20-minute reference call. What questions would you want to ask them?",
  },
  {
    category: "TRUST",
    trigger: "What if your team doesn't show up when we need help?",
    rebuttal:
      "Two things that make that very unlikely: (1) our SLA + the named pod structure mean you have direct lines to people who know your environment, and (2) we publish our response-time numbers in QBRs. If we miss, you see it. Want me to share last quarter's?",
  },

  // SCOPE
  {
    category: "SCOPE",
    trigger: "We just need [one piece] — not the whole bundle.",
    rebuttal:
      "Totally workable — we sell line-by-line as well as bundled. Two things to weigh: (1) most clients see 60-70% of the value in the integration of MIT + Cyber + vCIO, and (2) standalone pricing is per-seat without the bundle discount. Want both options on the proposal so you can compare?",
  },
  {
    category: "SCOPE",
    trigger: "Can you handle just the cybersecurity side?",
    rebuttal:
      "Yes — Cyber-only is a real engagement we run. Heads-up: if your endpoint management lives elsewhere, our EDR + IR work depends on access to that stack. Worth a 15-min architecture call to make sure the seams won't bite us.",
  },

  // INTERNAL
  {
    category: "INTERNAL",
    trigger: "We can build this internally / our IT person handles it.",
    rebuttal:
      "Often true for the day-to-day. The two pieces internal teams typically struggle with are (1) 24×7 SOC coverage at a real cost, and (2) NIST/HIPAA/CMMC artifact production. Worth a 30-min readout where we map what's covered today and where the gaps are — internal-friendly conclusion is totally fine.",
  },
  {
    category: "INTERNAL",
    trigger: "We're hiring our own IT person.",
    rebuttal:
      "Smart for growing companies. A real pattern we see: the new IT lead is more effective when they're not also the SOC, the backup admin, AND the helpdesk. Our co-managed engagement keeps them owning architecture + vendor strategy while we run 24×7 ops. Worth a discussion once they're hired.",
  },

  // COMPLIANCE-driven
  {
    category: "COMPLIANCE",
    industry: Industry.MEDICAL,
    trigger: "Our previous MSP got us through HIPAA — we're set.",
    rebuttal:
      "Glad to hear it. Two checks: (1) when was the last Risk Analysis update, and (2) do you have current artifact evidence for the encryption + access-control controls? A 90-minute readout can verify or surface gaps — most practices have either #1 or #2 stale by year 2.",
  },
  {
    category: "COMPLIANCE",
    industry: Industry.FEDERAL_CONTRACTING,
    trigger: "We're already CMMC-ready / 800-171 compliant.",
    rebuttal:
      "Excellent. CMMC Level 2 audit cycles are tightening, so a parallel SPRS scoring run from us as an independent reviewer is often what assessors want to see. If your number stays the same, fantastic. If it shifts, you have time to fix before the cycle.",
  },
  {
    category: "COMPLIANCE",
    trigger: "Cyber insurance won't accept your stack.",
    rebuttal:
      "We work with the major underwriters — Coalition, Beazley, Travelers, Chubb. Tell me your carrier and I'll send the questionnaire-line-by-line answer they want, before we sign anything.",
  },

  // Catch-alls
  {
    category: "TRUST",
    trigger: "Send me a proposal and I'll review.",
    rebuttal:
      "Happy to — and the proposal will be sharper after a Discovery Call. Otherwise I'm pricing a guess. 45 minutes; we cover business, tech, decision, and a mini-pitch. Tuesday or Thursday work?",
  },
  {
    category: "TIMING",
    trigger: "Email me and I'll get back to you.",
    rebuttal:
      "Sure — what specifically should the email say so you have what you need to decide on a next step? Last thing I want is to send something that gets ignored because it didn't answer your real question.",
  },
  {
    category: "PRICE",
    trigger: "Why is the onboarding fee so high?",
    rebuttal:
      "Onboarding pays for the documented baseline — environment discovery, IT-Glue/Hudu build, identity + endpoint inventory, runbooks. Skipping it is what creates the 'we don't know what we have' problem that month 3 inevitably hits. We can phase it across two months if cashflow timing matters.",
  },
  {
    category: "SCOPE",
    trigger: "We don't need a vCIO — just a helpdesk.",
    rebuttal:
      "Fair — and we sell helpdesk-only when it fits. The vCIO retainer is usually what stops clients from making expensive accidental decisions (servers nobody needed, M365 licenses overpurchased, audits walked into blind). Want me to share two examples where vCIO time paid for itself in the same quarter?",
  },
];
