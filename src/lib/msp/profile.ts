/**
 * v2.21 — MSP business profile.
 *
 * Single SystemConfig blob (`msp.profile`) that every Claude prompt
 * reads at runtime so AI output reflects the company's mission, voice,
 * service emphasis, and real win stories instead of hardcoded generic
 * Gateway TelNet text.
 *
 * Storage / loading mirrors src/lib/pricing/loader.ts (30s cache,
 * fallback to DEFAULT_PROFILE).
 *
 * Editing is SUPERADMIN-only via /admin/msp-profile (RBAC key
 * `msp:profile:edit`).
 */

import { Industry, ServiceLine } from "@prisma/client";

export type ServiceEmphasis = "focus" | "normal" | "de-emphasize";

export type ServiceLineProfile = {
  /** Prisma ServiceLine enum value. Every enum value is represented;
   *  the order in the array drives display order in the prompt. */
  serviceLine: ServiceLine;
  /** Drives how strongly Claude should surface this in recommendations.
   *  `focus`: lean toward it when fits. `normal`: mention as appropriate.
   *  `de-emphasize`: only propose if customer explicitly asks. */
  emphasis: ServiceEmphasis;
  /** Optional one-line context. Surfaced verbatim in the prompt block.
   *  Examples: "Q2 push — new MSP-XDR bundle", "Capacity-constrained
   *  through Q3, only sell to existing accounts". */
  note?: string;
};

export type WinStory = {
  /** Industry the story applies to. "ANY" means cite it on any
   *  industry; otherwise restricted to matching leads. */
  industry: Industry | "ANY";
  /** Plain-language description of the customer + their starting
   *  state. Stay anonymized — no real names. */
  situation: string;
  /** What Gateway delivered + the measurable outcome. */
  outcome: string;
};

export type MspProfile = {
  /** ISO timestamp set on every save. Used for cache-busting + audit. */
  version: string;
  /** Company display name — shown verbatim in every prompt. */
  companyName: string;
  /** Headquarter location — drives geographic-relevance signals. */
  location: string;
  /** One-line positioning, e.g. "a Southern-California managed-services
   *  provider". */
  tagline: string;
  /** Mission statement — Claude uses this to anchor the "why we exist". */
  missionStatement: string;
  /** Free-text voice / tone guidelines. Read by Claude as style rules. */
  brandVoice: string;
  /** Longer company background. AI uses for context when the customer
   *  asks "tell me about your company". */
  background: string;
  /** Differentiators / "why us" — list of short phrases. */
  differentiators: string[];
  /** Target market verticals. Defaults to the 9 industries Gateway
   *  named in v2.20 hardcoded prompts. */
  targetMarkets: string[];
  /** Every ServiceLine enum value tagged with emphasis + optional note. */
  services: ServiceLineProfile[];
  /** Explicit out-of-scope statements so AI doesn't over-promise.
   *  Examples: "We don't do consumer / residential support". */
  outOfScope: string[];
  /** Anonymized win stories for AI to cite in objection handling +
   *  outreach. Empty array is fine. */
  winStories: WinStory[];
};

// ---------------------------------------------------------------------------
// DEFAULT_PROFILE
//
// Extracted from the hardcoded Gateway identity in v2.20 AI lib files
// (research-summary.ts, objection-coach.ts, etc.). On first deploy
// SystemConfig is empty and this is what every Claude call sees. As
// soon as a SUPERADMIN saves on /admin/msp-profile, this is overridden.
// ---------------------------------------------------------------------------

export const DEFAULT_PROFILE: MspProfile = {
  // v3.3.5 — rebalanced from cyber-first to full-stack so AI prompts
  // stop defaulting every recommendation to "harden security + NIST".
  // We genuinely sell voice, access control, video, cabling, and AI
  // advisory as standalone revenue lines, not afterthoughts.
  version: "2026-05-26-fullstack",
  companyName: "Gateway TelNet",
  location: "Burbank, CA",
  tagline: "a Southern-California managed-services and technology partner",
  missionStatement:
    "Help SoCal businesses run on reliable IT, modern phones, secure facilities, and the right AI strategy — without juggling four vendors.",
  // v3.3.25 — adopt the real gatewaytelnet.com voice. Specific snippets
  // surfaced on the marketing site: "We listen more and talk less. We
  // seek to understand, we measure twice and cut once." + "Technology
  // is like an FTE, which you only have to pay for once." AI engagements
  // should match this register.
  brandVoice:
    "Match the gatewaytelnet.com voice. Headline values: \"We listen more, talk less.\" \"Measure twice, cut once.\" \"Technology is like an FTE — pay for it once.\" Warm + direct, no fluff, no MBA-speak. Specific over generic. Concrete over vague. We respect the reader's time.",
  background:
    "Gateway TelNet is a Burbank-based managed services and technology partner serving Southern California businesses since the early 2000s. Our stack spans managed IT, cybersecurity, hosted voice, structured cabling, access control, video surveillance, vCIO strategy, AI advisory, and NIST/CMMC compliance — sold individually or as bundles. The differentiator is breadth: a customer can move offices, modernize phones, harden security, and roll out badge readers without onboarding four separate vendors.",
  differentiators: [
    "One vendor across IT, voice, cabling, access control, video, and strategy — projects don't get stuck between trades",
    "Local SoCal feet-on-the-ground for on-site installs (no remote-only)",
    "vCIO retainer included on the Compliance+ bundle — strategic roadmap, not just tickets",
    "Project + MRR pricing both — you can buy phones outright, run a cabling job, or sign a multi-year managed agreement",
    "Annual NIST/CMMC pre-audit built into Compliance+ and Enterprise — auditors find nothing new",
  ],
  targetMarkets: [
    "Medical",
    "Legal",
    "Federal Contracting",
    "Manufacturing",
    "Hospitality",
    "Financial Services",
    "Professional Services",
    "Education",
    "Nonprofit",
    "Retail / Multi-location",
  ],
  services: [
    {
      serviceLine: ServiceLine.MANAGED_IT,
      emphasis: "focus",
      note: "Anchor recurring revenue — most cross-sells attach to a managed IT customer",
    },
    {
      serviceLine: ServiceLine.CYBERSECURITY,
      emphasis: "normal",
      note: "Pair with Managed IT for bundles; standalone when client renews insurance or fails a vendor questionnaire",
    },
    {
      serviceLine: ServiceLine.VOIP,
      emphasis: "focus",
      note: "Real standalone revenue line — VoIP project deals close fast and are a clean cross-sell into managed IT later",
    },
    {
      serviceLine: ServiceLine.ACCESS_CONTROL,
      emphasis: "focus",
      note: "Standalone project work, no MRR. Wedge for multi-location retail / professional services modernizing facilities",
    },
    {
      serviceLine: ServiceLine.VIDEO,
      emphasis: "focus",
      note: "Standalone project work, no MRR. Often paired with access control; insurance / liability driver",
    },
    {
      serviceLine: ServiceLine.AI_ADVISORY,
      emphasis: "focus",
      note: "Forward-positioning — leaders are getting pressure to 'use AI'; we lead with workshops + measured pilots",
    },
    {
      serviceLine: ServiceLine.CABLING,
      emphasis: "normal",
      note: "Project work tied to new offices, build-outs, voice rollouts, or PoE for cameras / access readers",
    },
    {
      serviceLine: ServiceLine.VCIO_RETAINER,
      emphasis: "normal",
      note: "Standalone retainer for clients between 'need an IT person' and 'need a CIO'",
    },
    {
      serviceLine: ServiceLine.NIST_ASSESSMENT,
      emphasis: "normal",
      note: "Triggered by compliance driver (HIPAA, PCI, CMMC) or insurance pressure. Don't lead with it unless the customer signals it",
    },
  ],
  outOfScope: [
    "Consumer / residential support",
    "Custom software development beyond integrations",
    "Single-incident break/fix work without a service contract",
  ],
  winStories: [],
};
