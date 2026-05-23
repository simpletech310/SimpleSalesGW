/**
 * Gateway portal glossary — plain-language definitions for every acronym and
 * piece of MSP / sales jargon that shows up in the UI. Used by:
 *   - <GlossaryTerm term="..."> wrapper for inline hover help
 *   - The /help page glossary section
 *
 * Definitions are deliberately short (one to three sentences) and written for
 * a brand-new salesperson reading them for the first time.
 */

export type GlossaryEntry = {
  /** The acronym or shorthand as it appears in the UI. */
  term: string;
  /** Plain-English explanation. Keep under 250 characters. */
  definition: string;
  /** Optional category for the /help page grouping. */
  category?: "compliance" | "tooling" | "sales" | "ops" | "general";
};

export const GLOSSARY: ReadonlyArray<GlossaryEntry> = [
  // ---------- compliance frameworks
  {
    term: "NIST CSF",
    category: "compliance",
    definition:
      "NIST Cybersecurity Framework — a 6-function (Govern · Identify · Protect · Detect · Respond · Recover) scorecard. The most common cyber-insurance, HIPAA, and SOC 2 baseline.",
  },
  {
    term: "NIST 800-171",
    category: "compliance",
    definition:
      "110-control overlay required by U.S. DoD contractors handling Controlled Unclassified Information (CUI). The technical basis for CMMC Level 2.",
  },
  {
    term: "SPRS",
    category: "compliance",
    definition:
      "Supplier Performance Risk System — the DoD's scorecard for 800-171 readiness. Score starts at 110 and gets deducted per unmet control. Reported to register for DoD contracts.",
  },
  {
    term: "POAM",
    category: "compliance",
    definition:
      "Plan of Action & Milestones — the register of controls not yet implemented, with target completion dates. Required for 800-171 / CMMC submissions.",
  },
  {
    term: "SSP",
    category: "compliance",
    definition:
      "System Security Plan — the narrative document that describes how a customer meets each 800-171 control. Submitted alongside the SPRS score.",
  },
  {
    term: "CMMC",
    category: "compliance",
    definition:
      "Cybersecurity Maturity Model Certification — the DoD's enforcement layer on top of NIST 800-171. Level 2 is the common bar for contractors handling CUI.",
  },
  {
    term: "HIPAA",
    category: "compliance",
    definition:
      "The U.S. healthcare privacy + security law. Applies to any business handling Protected Health Information (PHI). Requires Risk Analysis, BAA contracts with vendors, and breach notification.",
  },
  {
    term: "PCI",
    category: "compliance",
    definition:
      "Payment Card Industry Data Security Standard — required of any business that stores, processes, or transmits cardholder data. 12 high-level requirements.",
  },
  {
    term: "SOC 2",
    category: "compliance",
    definition:
      "A third-party audit attesting that a company meets five Trust Services Criteria: security, availability, processing integrity, confidentiality, privacy. Common when selling to enterprise.",
  },

  // ---------- tooling
  {
    term: "RMM",
    category: "tooling",
    definition:
      "Remote Monitoring & Management — the agent we deploy to every endpoint to patch, monitor, and remotely access machines. Examples: ConnectWise Automate, NinjaOne, Datto RMM.",
  },
  {
    term: "EDR",
    category: "tooling",
    definition:
      "Endpoint Detection & Response — next-generation antivirus that uses behavior analysis to catch threats traditional AV misses. Examples: SentinelOne, CrowdStrike, Huntress.",
  },
  {
    term: "MFA",
    category: "tooling",
    definition:
      "Multi-Factor Authentication — requires a second factor (phone push, hardware key) in addition to a password. The single highest-impact security control.",
  },
  {
    term: "PSA",
    category: "tooling",
    definition:
      "Professional Services Automation — the ticketing + billing platform Gateway runs on. We use ConnectWise.",
  },
  {
    term: "ConnectWise",
    category: "tooling",
    definition:
      "Gateway's PSA (ticketing + billing) platform. Every customer relationship, ticket, agreement, and invoice lives in ConnectWise.",
  },
  {
    term: "ITGlue",
    category: "tooling",
    definition:
      "IT documentation platform where we keep network diagrams, credentials, runbooks, and vendor info. Gateway uses ITGlue or Hudu depending on customer.",
  },

  // ---------- contracts
  {
    term: "MSA",
    category: "sales",
    definition:
      "Master Services Agreement — the umbrella contract that governs the relationship. Signed once at the start; SOWs attach under it.",
  },
  {
    term: "SOW",
    category: "sales",
    definition:
      "Statement of Work — defines the specific scope, deliverables, pricing, and timeline for a single engagement under the MSA. Each new project gets its own SOW.",
  },
  {
    term: "BAA",
    category: "sales",
    definition:
      "Business Associate Agreement — HIPAA-required contract when Gateway will handle Protected Health Information. We sign one with every medical customer.",
  },
  {
    term: "NDA",
    category: "sales",
    definition:
      "Non-Disclosure Agreement — mutual confidentiality contract signed before discovery so we can talk specifics.",
  },
  {
    term: "DPA",
    category: "sales",
    definition:
      "Data Processing Addendum — addendum to the MSA that defines data-handling responsibilities. Required for GDPR-relevant customers.",
  },

  // ---------- sales / pricing
  {
    term: "below-floor pricing",
    category: "sales",
    definition:
      "When the proposed monthly recurring revenue (MRR) is lower than the bundle's published floor per seat. Forces a COO approval regardless of discount percent.",
  },
  {
    term: "non-strategic deal",
    category: "sales",
    definition:
      "A deal flagged as below Gateway's deal-quality bar. Cannot advance past Proposal without Sales Manager approval. Designed to keep the pipeline healthy.",
  },
  {
    term: "MRR",
    category: "sales",
    definition:
      "Monthly Recurring Revenue — the predictable monthly fee for managed services (not one-time onboarding). The number that matters for valuation.",
  },
  {
    term: "ARR",
    category: "sales",
    definition: "Annual Recurring Revenue — MRR × 12. Used for annual reporting and contract value.",
  },
  {
    term: "vCIO",
    category: "sales",
    definition:
      "Virtual Chief Information Officer — Gateway's strategic IT advisor role for the customer. Runs the QBR cadence, owns the roadmap, plans for the next 12 months.",
  },
  {
    term: "QBR",
    category: "sales",
    definition:
      "Quarterly Business Review — a 90-minute meeting every ~90 days where Gateway + customer review IT health, security posture, roadmap progress, and what's next.",
  },

  // ---------- ops
  {
    term: "MTTR",
    category: "ops",
    definition:
      "Mean Time To Resolution — the average time it takes to close a ticket. Tracked per service line as a quality metric.",
  },
  {
    term: "SLA",
    category: "ops",
    definition:
      "Service Level Agreement — the response and resolution time commitments Gateway makes per ticket priority. Published in the SOW.",
  },
  {
    term: "SOC",
    category: "ops",
    definition:
      "Security Operations Center — the 24×7 team monitoring EDR alerts, SIEM events, and incident response. Gateway buys SOC services and resells them as part of Cybersecurity bundles.",
  },
  {
    term: "DR",
    category: "ops",
    definition:
      "Disaster Recovery — the plan + tooling for restoring operations after a major incident. RPO (how much data you can lose) and RTO (how fast you can be back up) define the targets.",
  },

  // ---------- onboarding phases
  {
    term: "discovery",
    category: "ops",
    definition:
      "Phase 1 of post-sale onboarding. vCIO runs the Site Survey, AI Readiness Questionnaire, and NIST CSF assessment to map the customer's current state.",
  },
  {
    term: "pre-engagement",
    category: "ops",
    definition:
      "Phase 0 of post-sale onboarding. Contracts counter-signed, welcome email sent, access requested, kickoff call scheduled.",
  },
  {
    term: "stabilize",
    category: "ops",
    definition:
      "Phase 3 of post-sale onboarding. Customer is on Gateway tooling; we tune alerts, confirm SLA, and prep the first QBR.",
  },
  {
    term: "steady state",
    category: "ops",
    definition:
      "Phase 4 of post-sale onboarding. Recurring vCIO cadence (weekly internal · monthly client · quarterly QBR · annual review).",
  },
];

const BY_TERM = new Map(GLOSSARY.map((e) => [e.term.toLowerCase(), e]));

export function findGlossaryEntry(term: string): GlossaryEntry | undefined {
  return BY_TERM.get(term.toLowerCase());
}

export const GLOSSARY_CATEGORIES = ["compliance", "tooling", "sales", "ops", "general"] as const;

export function glossaryByCategory(): Record<string, GlossaryEntry[]> {
  const out: Record<string, GlossaryEntry[]> = {};
  for (const cat of GLOSSARY_CATEGORIES) out[cat] = [];
  for (const e of GLOSSARY) {
    const c = e.category ?? "general";
    out[c]!.push(e);
  }
  return out;
}
