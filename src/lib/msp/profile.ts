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
  version: "2026-05-23-defaults",
  companyName: "Gateway TelNet",
  location: "Burbank, CA",
  tagline: "a Southern-California managed-services provider",
  missionStatement:
    "Help SoCal SMBs run on reliable IT and pass their next compliance audit without hiring a CIO.",
  brandVoice:
    "Warm + direct, no fluff, no MBA-speak. Specific over generic. Concrete over vague. We respect the reader's time.",
  background:
    "Gateway TelNet is a Burbank-based MSP serving Southern California businesses since the early 2000s. We bundle managed IT with cybersecurity + NIST/CMMC compliance because the two cannot live separately in 2026. We also handle voice, cabling, access control, and video surveillance so a customer never has to coordinate 4 vendors for a new office.",
  differentiators: [
    "Built-in NIST/CMMC pre-audit at every annual renewal",
    "Single throat to choke for IT + voice + physical security",
    "vCIO retainer included on the Compliance+ bundle, no per-hour billing surprises",
    "Local SoCal feet-on-the-ground for on-site work (no remote-only)",
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
  ],
  services: [
    { serviceLine: ServiceLine.MANAGED_IT, emphasis: "focus", note: "Anchor service — everything else attaches" },
    { serviceLine: ServiceLine.CYBERSECURITY, emphasis: "focus", note: "Required pair with Managed IT in 2026" },
    { serviceLine: ServiceLine.NIST_ASSESSMENT, emphasis: "focus", note: "Compliance is the wedge for Medical / Federal / Legal" },
    { serviceLine: ServiceLine.AI_ADVISORY, emphasis: "normal", note: "New offering — push where customer asks about AI" },
    { serviceLine: ServiceLine.VCIO_RETAINER, emphasis: "normal" },
    { serviceLine: ServiceLine.VOIP, emphasis: "normal", note: "Cross-sell on existing Managed IT customers" },
    { serviceLine: ServiceLine.CABLING, emphasis: "normal", note: "Project-based, tied to new-office moves" },
    { serviceLine: ServiceLine.ACCESS_CONTROL, emphasis: "normal" },
    { serviceLine: ServiceLine.VIDEO, emphasis: "normal" },
  ],
  outOfScope: [
    "Consumer / residential support",
    "Custom software development beyond integrations",
    "Single-incident break/fix work without a service contract",
  ],
  winStories: [],
};
