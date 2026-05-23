/**
 * Outreach template library — static config.
 * Real templates will replace these in v1.1 (from the Outreach Templates Library).
 * Use {{double-curly}} for placeholders so the UI can highlight them.
 */

export type OutreachTemplate = {
  id: string;
  name: string;
  category: "intro" | "follow_up" | "post_assessment" | "proposal" | "nurture";
  subject: string;
  body: string;
  placeholders: ReadonlyArray<string>;
};

export const OUTREACH_TEMPLATES: ReadonlyArray<OutreachTemplate> = [
  {
    id: "intro_short",
    name: "Intro — short & warm",
    category: "intro",
    subject: "{{first_name}}, quick intro from Gateway TelNet",
    body:
`Hi {{first_name}},

I'm Lin with Gateway TelNet. We help {{industry}} businesses around Southern California run their technology end-to-end — managed IT, voice, security, cabling, and AI strategy.

Worth a 15-minute call to compare notes on what's working (and what's not) on your stack?

— Lin
Gateway TelNet
`,
    placeholders: ["first_name", "industry"],
  },
  {
    id: "follow_up_no_response",
    name: "Follow up — no response",
    category: "follow_up",
    subject: "Following up — {{business_name}}",
    body:
`Hi {{first_name}},

Following up on my note last week. No urgency on my end — happy to share a one-pager on how we work with {{industry}} clients if that's useful, or just close the loop.

— Lin
`,
    placeholders: ["first_name", "business_name", "industry"],
  },
  {
    id: "post_assessment_recap",
    name: "Post-assessment recap",
    category: "post_assessment",
    subject: "Recap from our session, {{first_name}}",
    body:
`Hi {{first_name}},

Thanks for walking through the Basic IT Assessment with me. Here's what we agreed are the top two areas to address:

1. {{priority_one}}
2. {{priority_two}}

I'll send a scoped proposal by {{follow_up_date}}. In the meantime, let me know if anything changes.

— Lin
`,
    placeholders: ["first_name", "priority_one", "priority_two", "follow_up_date"],
  },
  {
    id: "proposal_sent",
    name: "Proposal sent",
    category: "proposal",
    subject: "Gateway proposal for {{business_name}}",
    body:
`Hi {{first_name}},

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
    id: "nurture_quarterly",
    name: "Nurture — quarterly check-in",
    category: "nurture",
    subject: "Quarterly hello from Gateway",
    body:
`Hi {{first_name}},

Just checking in. We've been busy with {{recent_focus}} for several SoCal {{industry}} clients lately.

Anything we should put back on the radar at {{business_name}}?

— Lin
`,
    placeholders: ["first_name", "business_name", "industry", "recent_focus"],
  },
];

export function listTemplates() { return OUTREACH_TEMPLATES; }
export function findTemplate(id: string) { return OUTREACH_TEMPLATES.find((t) => t.id === id); }

/** Fill placeholders with values, leaving unknown ones intact. */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}
