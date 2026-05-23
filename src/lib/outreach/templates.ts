/**
 * Outreach template library — DB-backed in v2.2, with static seed defaults so
 * fresh dev environments and the editor's "Restore default" action always have
 * a known-good baseline to pull from.
 *
 * Use {{double-curly}} placeholders so the UI can highlight them. The `placeholders`
 * array on each template is auto-detected from the body on save.
 */

import { Industry, OutreachCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type OutreachTemplate = {
  id: string;
  name: string;
  category: OutreachCategory;
  industry?: Industry | null;
  trigger?: string | null;
  subject: string;
  body: string;
  placeholders: ReadonlyArray<string>;
  active?: boolean;
};

/** Extract `{{placeholder}}` tokens from text. Returns unique tokens in first-seen order. */
export function extractPlaceholders(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const key = match[1]!;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

/** Fill placeholders with values, leaving unknown ones intact. */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

// ---------------------------------------------------------------------------
// Default seed templates (5 originals + 10 v2.2 additions for vertical /
// trigger-driven outreach per the paper Outreach Templates Library).
// ---------------------------------------------------------------------------

export const DEFAULT_OUTREACH_TEMPLATES: ReadonlyArray<Omit<OutreachTemplate, "id">> = [
  // -- Originals -----------------------------------------------------------
  {
    name: "Intro — short & warm",
    category: OutreachCategory.INTRO,
    subject: "{{first_name}}, quick intro from Gateway TelNet",
    body: `Hi {{first_name}},

I'm Lin with Gateway TelNet. We help {{industry}} businesses around the Houston metro run their technology end-to-end — managed IT, voice, security, cabling, and AI strategy.

Worth a 15-minute call to compare notes on what's working (and what's not) on your stack?

— Lin
Gateway TelNet
`,
    placeholders: ["first_name", "industry"],
  },
  {
    name: "Follow up — no response",
    category: OutreachCategory.FOLLOW_UP,
    subject: "Following up — {{business_name}}",
    body: `Hi {{first_name}},

Following up on my note last week. No urgency on my end — happy to share a one-pager on how we work with {{industry}} clients if that's useful, or just close the loop.

— Lin
`,
    placeholders: ["first_name", "business_name", "industry"],
  },
  {
    name: "Post-assessment recap",
    category: OutreachCategory.POST_ASSESSMENT,
    subject: "Recap from our session, {{first_name}}",
    body: `Hi {{first_name}},

Thanks for walking through the Basic IT Assessment with me. Here's what we agreed are the top two areas to address:

1. {{priority_one}}
2. {{priority_two}}

I'll send a scoped proposal by {{follow_up_date}}. In the meantime, let me know if anything changes.

— Lin
`,
    placeholders: ["first_name", "priority_one", "priority_two", "follow_up_date"],
  },
  {
    name: "Proposal sent",
    category: OutreachCategory.PROPOSAL,
    subject: "Gateway proposal for {{business_name}}",
    body: `Hi {{first_name}},

Attached is our proposal for {{business_name}}. Quick highlights:

— Scope: {{scope_summary}}
— Investment: {{investment_summary}}
— Start: {{proposed_start}}

Let's get on a call to walk through it. I have time {{availability}}.

— Lin
`,
    placeholders: ["first_name", "business_name", "scope_summary", "investment_summary", "proposed_start", "availability"],
  },
  {
    name: "Nurture — quarterly check-in",
    category: OutreachCategory.NURTURE,
    subject: "Quarterly hello from Gateway",
    body: `Hi {{first_name}},

Just checking in. We've been busy with {{recent_focus}} for several Houston-area {{industry}} clients lately.

Anything we should put back on the radar at {{business_name}}?

— Lin
`,
    placeholders: ["first_name", "business_name", "industry", "recent_focus"],
  },

  // -- Vertical-specific cold opens ----------------------------------------
  {
    name: "Vertical intro — Medical (HIPAA driver)",
    category: OutreachCategory.INTRO,
    industry: Industry.MEDICAL,
    trigger: "cold_outreach",
    subject: "HIPAA-grade IT for {{business_name}}",
    body: `Hi {{first_name}},

I work with medical practices around Houston on HIPAA-aligned IT — managed endpoints + EDR, MFA-everywhere, backup with restore testing, and the audit log a Risk Analysis actually needs.

A handful of {{business_name}}-size practices have moved to us after a cyber-insurance questionnaire or a near-miss. Worth a 20-minute call to see if any of it lines up?

— Lin
Gateway TelNet
`,
    placeholders: ["first_name", "business_name"],
  },
  {
    name: "Vertical intro — Legal",
    category: OutreachCategory.INTRO,
    industry: Industry.LEGAL,
    trigger: "cold_outreach",
    subject: "{{first_name}} — how {{business_name}} is handling client-data confidentiality on the IT side",
    body: `Hi {{first_name}},

A few law firms in town have asked us to help them get their IT to a place where they can answer "yes" cleanly when corporate clients ask about confidentiality controls + breach reporting.

Worth comparing notes on what {{business_name}} has in place today? I'm not pitching a re-platform — usually the lift is smaller than people expect.

— Lin
Gateway TelNet
`,
    placeholders: ["first_name", "business_name"],
  },
  {
    name: "Vertical intro — Federal contractor / CMMC",
    category: OutreachCategory.INTRO,
    industry: Industry.FEDERAL_CONTRACTING,
    trigger: "cmmc_driver",
    subject: "CMMC Level 2 readiness for {{business_name}}",
    body: `Hi {{first_name}},

If DoD work is on the roadmap, CMMC Level 2 (the new 800-171 enforcement) is going to land in the next contract cycle. We do the gap analysis + SSP + POAM build-out + the day-to-day controls to keep it green.

If you'd like, I'll send a one-page sample SSP and a SPRS-score worksheet — no obligation.

— Lin
Gateway TelNet
`,
    placeholders: ["first_name", "business_name"],
  },
  {
    name: "Vertical intro — Manufacturing",
    category: OutreachCategory.INTRO,
    industry: Industry.MANUFACTURING,
    trigger: "cold_outreach",
    subject: "OT/IT separation + uptime for {{business_name}}",
    body: `Hi {{first_name}},

We help small-to-mid manufacturers around Houston with the OT/IT side — keeping the line up, segmenting machine networks from the corp LAN, and handling the cyber-insurance questionnaire when it shows up at renewal.

15-minute call to see if any of it lines up at {{business_name}}?

— Lin
Gateway TelNet
`,
    placeholders: ["first_name", "business_name"],
  },
  {
    name: "Vertical intro — Hospitality",
    category: OutreachCategory.INTRO,
    industry: Industry.HOSPITALITY,
    trigger: "cold_outreach",
    subject: "{{first_name}} — PCI + guest Wi-Fi without surprises",
    body: `Hi {{first_name}},

If guest Wi-Fi, POS, and a PCI deadline are all on your IT plate, you're not alone. We work with hotels and restaurants around Houston to get the segmentation right and keep the PCI scope small.

Worth a quick call?

— Lin
Gateway TelNet
`,
    placeholders: ["first_name"],
  },

  // -- Channel + trigger-driven --------------------------------------------
  {
    name: "LinkedIn InMail — connection + intro",
    category: OutreachCategory.INTRO,
    trigger: "linkedin_inmail",
    subject: "Connecting on LinkedIn — Gateway TelNet",
    body: `Hi {{first_name}},

Saw your post on {{post_topic}} — really resonated. I'm Lin at Gateway TelNet; we do MSP / cyber / vCIO for {{industry}} shops your size around Houston.

Open to connecting? No pitch attached.

— Lin
`,
    placeholders: ["first_name", "industry", "post_topic"],
  },
  {
    name: "Voicemail — left after no-pickup",
    category: OutreachCategory.FOLLOW_UP,
    trigger: "voicemail_left",
    subject: "Voicemail follow-up",
    body: `Hi {{first_name}},

Just left you a voicemail. Quick context: I'm Lin with Gateway TelNet, and I'd like 15 minutes to compare notes on how IT is currently handled at {{business_name}}.

What's the best time + number to reach you on this week?

— Lin
`,
    placeholders: ["first_name", "business_name"],
  },
  {
    name: "Re-engage — stalled deal",
    category: OutreachCategory.NURTURE,
    trigger: "stalled_deal",
    subject: "Circling back — {{business_name}}",
    body: `Hi {{first_name}},

Wanted to circle back on the IT/cyber conversation. Totally fine if priorities shifted — just want to make sure I'm not missing a window.

Two paths:
 1) Re-open the conversation. I'll send a fresh 1-pager.
 2) Close the loop — I'll stop nudging.

Which way?

— Lin
`,
    placeholders: ["first_name", "business_name"],
  },
  {
    name: "Post-meeting thank-you",
    category: OutreachCategory.FOLLOW_UP,
    trigger: "post_meeting",
    subject: "Thanks for the time today, {{first_name}}",
    body: `Hi {{first_name}},

Thanks for the time today. Quick recap of what we agreed:

— Next step: {{next_step}}
— Owner on my end: {{my_owner}}
— Owner on your end: {{their_owner}}
— Target date: {{target_date}}

Reach out anytime if anything shifts.

— Lin
`,
    placeholders: ["first_name", "next_step", "my_owner", "their_owner", "target_date"],
  },
  {
    name: "Proposal follow-up — radio silence",
    category: OutreachCategory.PROPOSAL,
    trigger: "proposal_silence",
    subject: "Following up on the proposal — {{business_name}}",
    body: `Hi {{first_name}},

Following up on the proposal I sent {{days_ago}} days ago. Three possible next moves:

 1) Walk through it together — I have time {{availability}}.
 2) Reply with edits / scope changes you'd want and I'll re-issue.
 3) Pause for now — just let me know and I'll close the loop.

Any of those work?

— Lin
`,
    placeholders: ["first_name", "business_name", "days_ago", "availability"],
  },
];

// ---------------------------------------------------------------------------
// DB loader
// ---------------------------------------------------------------------------

export type TemplateFilter = {
  industry?: Industry | null;
  trigger?: string | null;
  category?: OutreachCategory | null;
};

function defaultsToReadonly(): ReadonlyArray<OutreachTemplate> {
  return DEFAULT_OUTREACH_TEMPLATES.map((t, idx) => ({
    id: `default-${idx + 1}`,
    name: t.name,
    category: t.category,
    industry: t.industry ?? null,
    trigger: t.trigger ?? null,
    subject: t.subject,
    body: t.body,
    placeholders: t.placeholders,
    active: true,
  }));
}

/**
 * Load templates from DB, optionally filtered. Falls back to the static
 * defaults if the DB has no rows yet (fresh environments).
 */
export async function loadOutreachTemplates(filter: TemplateFilter = {}): Promise<OutreachTemplate[]> {
  try {
    const rows = await prisma.outreachTemplate.findMany({
      where: {
        active: true,
        ...(filter.category ? { category: filter.category } : {}),
        ...(filter.industry !== undefined
          ? filter.industry === null
            ? { industry: null }
            : { OR: [{ industry: filter.industry }, { industry: null }] }
          : {}),
        ...(filter.trigger !== undefined
          ? filter.trigger === null
            ? { trigger: null }
            : { OR: [{ trigger: filter.trigger }, { trigger: null }] }
          : {}),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    if (rows.length === 0) return [...defaultsToReadonly()];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      industry: r.industry,
      trigger: r.trigger,
      subject: r.subject,
      body: r.body,
      placeholders: r.placeholders,
      active: r.active,
    }));
  } catch {
    return [...defaultsToReadonly()];
  }
}

/** Load a single template by id from the DB. */
export async function findOutreachTemplate(id: string): Promise<OutreachTemplate | null> {
  const row = await prisma.outreachTemplate.findUnique({ where: { id } });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    industry: row.industry,
    trigger: row.trigger,
    subject: row.subject,
    body: row.body,
    placeholders: row.placeholders,
    active: row.active,
  };
}

// ---------------------------------------------------------------------------
// Legacy compatibility: existing callers import OUTREACH_TEMPLATES /
// listTemplates / findTemplate. Keep them around so older code still compiles.
// ---------------------------------------------------------------------------

export const OUTREACH_TEMPLATES = defaultsToReadonly();
export function listTemplates() { return OUTREACH_TEMPLATES; }
export function findTemplate(id: string) { return OUTREACH_TEMPLATES.find((t) => t.id === id); }
