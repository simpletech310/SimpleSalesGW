import type { DiscoveryBank, DiscoveryQuestion } from "./types";

/**
 * AI Readiness Questionnaire — full-fidelity mirror of
 * 02-AI-Readiness-Questionnaire/AI_Readiness_Questionnaire_TEMPLATE.md.
 *
 * Sections: engagement metadata · executive snapshot · 8-dimension AI Maturity
 * Scorecard · governance & policy · data readiness · use-case discovery per
 * department (10 departments × 7 fields) · compliance & risk · tooling +
 * roadmap. ~120 fields total.
 */

function single(id: string, section: string, prompt: string, options: ReadonlyArray<{ value: string; label: string; weight?: number }>, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "single_select", required, options };
}
function multi(id: string, section: string, prompt: string, options: ReadonlyArray<{ value: string; label: string }>, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "multi_select", required, options };
}
function text(id: string, section: string, prompt: string, helpText?: string, required = false): DiscoveryQuestion {
  return { id, section, prompt, helpText, type: "text", required };
}
function bool(id: string, section: string, prompt: string, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "boolean", required };
}
function num(id: string, section: string, prompt: string, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "numeric", required };
}

const tierFour = [
  { value: "tier_0", label: "Tier 0 — Not aware / not started", weight: 0 },
  { value: "tier_1", label: "Tier 1 — Partial / ad-hoc", weight: 1 },
  { value: "tier_2", label: "Tier 2 — Risk-informed / pockets of practice", weight: 2 },
  { value: "tier_3", label: "Tier 3 — Repeatable / standardized", weight: 3 },
  { value: "tier_4", label: "Tier 4 — Adaptive / continuously improving", weight: 4 },
];

export const AI_READINESS_DEPARTMENTS = [
  "Sales",
  "Marketing",
  "Operations",
  "Finance",
  "HR",
  "Legal",
  "Engineering",
  "Customer Support",
  "Executive",
  "Other",
] as const;

const QS: DiscoveryQuestion[] = [];

// Engagement metadata
QS.push(
  text("EM01", "Engagement Metadata", "Engagement code / project name"),
  text("EM02", "Engagement Metadata", "Engagement start date"),
  text("EM03", "Engagement Metadata", "Engagement target end date"),
  text("EM04", "Engagement Metadata", "Gateway vCIO lead"),
  text("EM05", "Engagement Metadata", "Client executive sponsor"),
  text("EM06", "Engagement Metadata", "Departments in scope"),
  text("EM07", "Engagement Metadata", "Out-of-scope departments / business units"),
  text("EM08", "Engagement Metadata", "Reason for engagement (compliance / efficiency / strategic / curiosity)"),
  text("EM09", "Engagement Metadata", "Prior AI initiatives (succeeded or stalled)"),
  text("EM10", "Engagement Metadata", "Constraints (regulatory / vendor / cultural)"),
);

// Executive snapshot
QS.push(
  text("EX01", "Executive Snapshot", "Top 3 strategic outcomes the org wants from AI in 12 months"),
  text("EX02", "Executive Snapshot", "What does 'success with AI' look like to the CEO?"),
  text("EX03", "Executive Snapshot", "What's the most painful manual process today?"),
  text("EX04", "Executive Snapshot", "Where would 10x productivity move the needle most?"),
  text("EX05", "Executive Snapshot", "What's the budget posture for AI in next 12 months?"),
  text("EX06", "Executive Snapshot", "Risk tolerance (conservative / pragmatic / aggressive)?"),
  text("EX07", "Executive Snapshot", "Are there 'sacred cow' processes that must NOT be automated?"),
  text("EX08", "Executive Snapshot", "Who would lose if AI succeeded here? (political surface area)"),
);

// AI Maturity Scorecard — 8 dimensions
QS.push(
  single("MS01", "AI Maturity Scorecard", "Strategy & vision — clarity of org-wide AI direction", tierFour),
  single("MS02", "AI Maturity Scorecard", "Leadership & culture — executive engagement, employee attitude", tierFour),
  single("MS03", "AI Maturity Scorecard", "People & skills — internal expertise + hiring + training", tierFour),
  single("MS04", "AI Maturity Scorecard", "Data foundations — quality, accessibility, classification", tierFour),
  single("MS05", "AI Maturity Scorecard", "Tooling & infrastructure — AI platforms in active use", tierFour),
  single("MS06", "AI Maturity Scorecard", "Governance & ethics — policy, oversight, audit trail", tierFour),
  single("MS07", "AI Maturity Scorecard", "Operations — measurement, optimization, scaling", tierFour),
  single("MS08", "AI Maturity Scorecard", "Customer value — AI improving experience or outcomes", tierFour),
);

// Governance & policy
QS.push(
  single("GV01", "Governance & Policy", "Documented AI acceptable-use policy?", [
    { value: "published_trained", label: "Published + trained", weight: 4 },
    { value: "published", label: "Published only", weight: 3 },
    { value: "draft", label: "Draft exists", weight: 2 },
    { value: "informal", label: "Informal guidance", weight: 1 },
    { value: "none", label: "None", weight: 0 },
  ]),
  single("GV02", "Governance & Policy", "Vendor approval process for AI tools", [
    { value: "formal", label: "Formal vendor review", weight: 4 },
    { value: "informal", label: "Informal sign-off", weight: 2 },
    { value: "none", label: "None — anyone can sign up", weight: 0 },
  ]),
  single("GV03", "Governance & Policy", "Human review of AI outputs?", [
    { value: "always", label: "Always — human in the loop", weight: 4 },
    { value: "sometimes", label: "Sometimes / depends", weight: 2 },
    { value: "rarely", label: "Rarely", weight: 0 },
  ]),
  bool("GV04", "Governance & Policy", "Audit logging of AI prompts/outputs?"),
  bool("GV05", "Governance & Policy", "Data residency requirements documented for AI?"),
  bool("GV06", "Governance & Policy", "DLP / sensitive-data masking in front of AI tools?"),
  text("GV07", "Governance & Policy", "Who owns AI policy + governance?"),
  text("GV08", "Governance & Policy", "Cadence of policy review (none / annual / quarterly / continuous)"),
  bool("GV09", "Governance & Policy", "Public-facing AI use disclosed to customers (where required)?"),
  bool("GV10", "Governance & Policy", "Internal AI escalation path documented (when output is wrong)?"),
  text("GV11", "Governance & Policy", "Known governance incidents in last 12 months"),
  text("GV12", "Governance & Policy", "Other governance notes"),
);

// Data readiness
QS.push(
  single("DR01", "Data Readiness", "Data is centralized vs. siloed", [
    { value: "centralized", label: "Single platform / well-integrated", weight: 4 },
    { value: "mostly", label: "Mostly centralized, some silos", weight: 3 },
    { value: "mixed", label: "Mixed", weight: 2 },
    { value: "siloed", label: "Heavily siloed", weight: 1 },
    { value: "spreadsheets", label: "Mostly spreadsheets / email", weight: 0 },
  ]),
  single("DR02", "Data Readiness", "Data hygiene / quality", [
    { value: "high", label: "High — clean, deduplicated, current", weight: 4 },
    { value: "medium", label: "Medium — known issues", weight: 2 },
    { value: "low", label: "Low — needs cleanup before AI use", weight: 0 },
  ]),
  single("DR03", "Data Readiness", "Sensitive-data classification in place?", [
    { value: "labeled", label: "Yes — enforced labels", weight: 4 },
    { value: "policy_only", label: "Policy exists, not enforced", weight: 2 },
    { value: "no", label: "No", weight: 0 },
  ]),
  bool("DR04", "Data Readiness", "Document store usable as RAG source (SharePoint / Drive with clear permissions)?"),
  text("DR05", "Data Readiness", "Most important data domains (customers / orders / financials / cases / etc.)"),
  text("DR06", "Data Readiness", "Where each domain lives (system + format)"),
  text("DR07", "Data Readiness", "Refresh cadence per domain (real-time / nightly / monthly / static)"),
  text("DR08", "Data Readiness", "Data ownership per domain (steward names if any)"),
  bool("DR09", "Data Readiness", "Data dictionary / catalog exists?"),
  bool("DR10", "Data Readiness", "Lineage tracked (where data came from, how it was transformed)?"),
  text("DR11", "Data Readiness", "PII / PHI / PCI in scope and where it lives"),
  text("DR12", "Data Readiness", "Known data-quality issues blocking AI"),
  text("DR13", "Data Readiness", "Backup + retention practices for AI training data"),
  bool("DR14", "Data Readiness", "Any data sharing or licensing agreements that affect AI use?"),
  text("DR15", "Data Readiness", "Other data-readiness notes"),
);

// Use-case discovery per department (10 × 7 = 70)
for (const dept of AI_READINESS_DEPARTMENTS) {
  const slug = dept.replace(/\s+/g, "").substring(0, 5).toUpperCase();
  QS.push(
    text(`UC.${slug}.01`, `Use Cases · ${dept}`, `Top 3 manual / repetitive tasks in ${dept}`),
    text(`UC.${slug}.02`, `Use Cases · ${dept}`, `Top 1 process the ${dept} lead wishes was automated`),
    text(`UC.${slug}.03`, `Use Cases · ${dept}`, `Time spent on data entry / lookup per week (${dept})`),
    text(`UC.${slug}.04`, `Use Cases · ${dept}`, `AI tools currently used in ${dept} (sanctioned + shadow)`),
    single(`UC.${slug}.05`, `Use Cases · ${dept}`, `Estimated impact of automating the top use case`, [
      { value: "low", label: "Low (saves <2 hrs/wk)", weight: 1 },
      { value: "medium", label: "Medium (2-10 hrs/wk)", weight: 2 },
      { value: "high", label: "High (10-40 hrs/wk)", weight: 3 },
      { value: "transformational", label: "Transformational (new capability)", weight: 4 },
    ]),
    single(`UC.${slug}.06`, `Use Cases · ${dept}`, `Estimated feasibility (data + tooling + culture)`, [
      { value: "very_high", label: "Very high — ready today", weight: 4 },
      { value: "high", label: "High — light prep", weight: 3 },
      { value: "medium", label: "Medium — meaningful prep", weight: 2 },
      { value: "low", label: "Low — significant blockers", weight: 1 },
      { value: "very_low", label: "Very low — not feasible now", weight: 0 },
    ]),
    text(`UC.${slug}.07`, `Use Cases · ${dept}`, `Blockers preventing the top use case from being implemented`),
  );
}

// Compliance & risk
QS.push(
  multi("CR01", "Compliance & Risk", "Regulatory frameworks affecting AI use", [
    { value: "HIPAA", label: "HIPAA" },
    { value: "PCI", label: "PCI-DSS" },
    { value: "CMMC", label: "CMMC / NIST 800-171" },
    { value: "GLBA", label: "GLBA" },
    { value: "FTC", label: "FTC Safeguards" },
    { value: "SEC", label: "SEC cyber rules" },
    { value: "FERPA", label: "FERPA" },
    { value: "STATE_PRIVACY", label: "State privacy law (CCPA / etc.)" },
    { value: "EU_AI_ACT", label: "EU AI Act" },
    { value: "NONE", label: "None" },
  ]),
  text("CR02", "Compliance & Risk", "Specific AI-related restrictions in your regulated industry"),
  bool("CR03", "Compliance & Risk", "Customer contracts limiting AI use or data sharing?"),
  bool("CR04", "Compliance & Risk", "IP or proprietary data risk in current AI use?"),
  bool("CR05", "Compliance & Risk", "Bias / fairness risks identified?"),
  text("CR06", "Compliance & Risk", "How are AI errors detected and remediated?"),
  text("CR07", "Compliance & Risk", "Disclosure obligations to end users when AI is involved"),
  bool("CR08", "Compliance & Risk", "Incident response plan covers AI-specific incidents?"),
  text("CR09", "Compliance & Risk", "Insurance coverage for AI-related risks"),
  text("CR10", "Compliance & Risk", "Other compliance / risk notes"),
);

// Tooling + roadmap
QS.push(
  multi("TR01", "Tooling & Roadmap", "AI tools currently in use", [
    { value: "copilot_m365", label: "Microsoft 365 Copilot" },
    { value: "gemini_workspace", label: "Google Gemini / Workspace AI" },
    { value: "chatgpt", label: "ChatGPT (consumer or team)" },
    { value: "claude", label: "Anthropic Claude" },
    { value: "openai_api", label: "OpenAI API (custom)" },
    { value: "anthropic_api", label: "Anthropic API (custom)" },
    { value: "azure_openai", label: "Azure OpenAI Service" },
    { value: "aws_bedrock", label: "AWS Bedrock" },
    { value: "ms_copilot_studio", label: "Microsoft Copilot Studio" },
    { value: "custom_rag", label: "Custom RAG / agent stack" },
    { value: "none", label: "None officially" },
  ]),
  num("TR02", "Tooling & Roadmap", "Approximate monthly AI tool spend ($)"),
  text("TR03", "Tooling & Roadmap", "Highest-value AI tool in use today + why"),
  text("TR04", "Tooling & Roadmap", "Tool that disappointed expectations + why"),
  text("TR05", "Tooling & Roadmap", "Skills / training needed for the team"),
  text("TR06", "Tooling & Roadmap", "Quick-win targets (0-30 days)"),
  text("TR07", "Tooling & Roadmap", "Medium-horizon targets (31-90 days)"),
  text("TR08", "Tooling & Roadmap", "Strategic horizon targets (91-365 days)"),
  bool("TR09", "Tooling & Roadmap", "Do you want Gateway to run the AI program (vs. advise only)?"),
  text("TR10", "Tooling & Roadmap", "Internal champion(s) who would own AI program delivery"),
  text("TR11", "Tooling & Roadmap", "Success metric for AI program in 12 months"),
  text("TR12", "Tooling & Roadmap", "Anything else important"),
);

export const AI_READINESS_QUESTIONS: ReadonlyArray<DiscoveryQuestion> = QS;

export const AI_READINESS_BANK: DiscoveryBank = {
  kind: "AI_READINESS",
  questions: AI_READINESS_QUESTIONS,
};
