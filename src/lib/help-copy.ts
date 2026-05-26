/**
 * Help copy registry — every piece of plain-English help text that shows up
 * in form FieldHelp tooltips or inline hints lives here so jargon audits can
 * be done from a single file.
 *
 * Keys follow the pattern `feature.field` so consumers do:
 *   import { HELP } from "@/lib/help-copy";
 *   <FieldHelp>{HELP.lead.industry}</FieldHelp>
 */

export const HELP = {
  lead: {
    industry:
      "Pick the customer's primary industry. Gateway has nine priority verticals — fit drives scoring.",
    seatCount:
      "Total users at the customer who need IT support. Drives pricing tiers and bundle recommendation.",
    siteCount:
      "Number of physical locations. Multi-site customers usually need WAN failover + Site-to-Site VPN.",
    complianceDrivers:
      "Which regulations the customer must meet (HIPAA, PCI, CMMC, cyber insurance, etc.). Drives NIST scope.",
    currentMsp:
      "Their current IT provider. Helps us know what we're competing against and when their contract is up.",
    executiveSponsor:
      "The C-level champion who's pulling Gateway in. Without one, deals stall in procurement.",
    websiteUrl:
      "Pasting this lets the portal pull a fresh page snapshot during research and feed it to Gateway AI for a summary.",
    linkedinCompanyUrl:
      "LinkedIn company page URL. Used for the research summary — public data only.",
    googleBusinessUrl:
      "The customer's Google Business profile, if they have one. Hours and reviews flow into the research summary.",
  },

  qualification: {
    industryFit:
      "0–15. Score 12–15 for a Gateway priority vertical (Medical, Legal, Federal, Manufacturing, Hospitality, etc.).",
    sizeFit:
      "0–15. The Gateway sweet spot is 10–250 seats. Outside that band lowers the score.",
    geography:
      "0–10. Houston metro = 10. Texas = 7. National = 5. Remote-only = 4.",
    growthPosture:
      "0–10. Growing/hiring = 10. Stable = 6. Shrinking = 2.",
    authority:
      "0–15. 15 means the decision-maker is in the room and committed to evaluation. Lower if you're talking to gatekeepers.",
    budget:
      "0–15. Score high when there's an explicit IT spend line item, a cyber-insurance-driven budget unlock, or a clear funded need.",
    timeline:
      "0–10. 10 = compelling event (renewal, breach, audit, contract end). 0 = no urgency.",
    complianceDriver:
      "0–10. Active regulation pulling them in. HIPAA / PCI / CMMC / cyber insurance = 8–10.",
  },

  pricing: {
    bundle:
      "Foundation = managed IT + cyber baseline. Professional adds hosted voice + access control. Compliance+ adds NIST + vCIO retainer for regulated clients. Enterprise = the full stack (IT, voice, access, video, AI advisory, NIST). Standalone deals (voice-only, access-control project, cabling, cameras) don't use bundles — switch deal kind on the lead.",
    seats:
      "Snapshot at quote time. Sticker MRR per seat tiers down as seat count grows.",
    proposedMrr:
      "What you're proposing per month. Compared to the bundle's sticker price; discount % is calculated automatically.",
    proposedOneTime:
      "Proposed one-time onboarding fee. Discounts here route to Sales Manager regardless of MRR discount %.",
    multiYear:
      "Multi-year commits lock in pricing and force COO approval regardless of discount percent.",
    reason:
      "Why does this customer warrant this discount? Sales Manager and COO use this to decide.",
  },

  handoff: {
    dealValue:
      "Total contract value — MRR × term + onboarding. Helps Ops prioritize.",
    decisionMakers:
      "Up to 5 stakeholders. Authority = who decides. Temperature = where they sit on the support spectrum.",
    hardCommitments:
      "What was explicitly promised in the SOW. Each item should reference the SOW section number and have a deadline.",
    softCommitments:
      "Implied / verbal promises that aren't in the SOW. Ops needs to know these to avoid surprise expectations.",
    complianceOverlay:
      "Active regulations driving the engagement. Ops uses this to scope week-1 controls.",
    contractsSigned:
      "Which contract documents are signed and on file. MSA + SOW signed is the bar for handoff acceptance.",
    successCriteria:
      "How will Ops know they're succeeding at the 90-day mark? Concrete metrics with owners.",
    objections:
      "Anyone at the customer who's NOT on board. Ops needs to know who to be careful with in week 1.",
    budget:
      "Current state of customer's IT spend authority. Helps Ops know what additional asks will fly.",
  },

  pipeline: {
    stageGate:
      "Some stage transitions have recommended requirements. The portal warns but doesn't block — you can still proceed.",
  },

  discovery: {
    siteSurvey:
      "Technical state-of-the-union. ~120 questions across 15 sections — answer what you can, skip the rest.",
    aiReadiness:
      "Department-by-department AI maturity score (0–4 across 8 dimensions) + a use-case catalog scored by impact × feasibility.",
    nistCsf:
      "NIST Cybersecurity Framework 2.0 — 106 Subcategories scored on the Tier 1–4 maturity model. Required for compliance-driven customers.",
    nist800171:
      "110 controls for U.S. DoD contractors handling CUI. Generates SPRS score + SSP + POAM register.",
  },

  onboardingTask: {
    status:
      "PENDING → IN_PROGRESS → DONE. SKIPPED means it doesn't apply to this customer. BLOCKED means external dependency.",
    owner:
      "Assigned to a specific person. Unassigned tasks fall back to the default role for that task.",
    ownerRole:
      "Default role for unassigned tasks. Drives the role lens on /my-tasks.",
  },

  signedDocument: {
    type:
      "MSA = umbrella contract. SOW = scope per engagement. BAA = HIPAA contract. NDA = pre-discovery. DPA = data processing.",
    expiresAt:
      "When the agreement expires or auto-renews. The portal will warn you in /notifications when expiration is within 30 days.",
    publicUrl:
      "Direct link to the signed PDF in Vercel Blob storage or wherever you keep contracts.",
  },
} as const;
