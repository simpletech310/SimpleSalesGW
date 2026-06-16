import type { DiscoveryBank, DiscoveryQuestion } from "./types";

/**
 * v3.8 — AI Readiness (Light), ~18 Q.
 * A fast maturity read across the dimensions the full AI_READINESS bank covers
 * in depth: leadership, data, governance, skills, use-cases, tooling, risk.
 * Tier-weighted so `ai-readiness-light.ts` emits a readiness % + band.
 */

const tierFour = [
  { value: "tier_0", label: "Not started / not aware", weight: 0 },
  { value: "tier_1", label: "Ad-hoc / experimenting", weight: 1 },
  { value: "tier_2", label: "Pockets of practice", weight: 2 },
  { value: "tier_3", label: "Standardized / repeatable", weight: 3 },
  { value: "tier_4", label: "Optimized / continuously improving", weight: 4 },
];

function tier(id: string, section: string, prompt: string, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "single_select", required, options: tierFour };
}
function single(id: string, section: string, prompt: string, options: ReadonlyArray<{ value: string; label: string; weight?: number }>, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "single_select", required, options };
}
function multi(id: string, section: string, prompt: string, options: ReadonlyArray<{ value: string; label: string }>, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "multi_select", required, options };
}
function text(id: string, section: string, prompt: string, helpText?: string, required = false): DiscoveryQuestion {
  return { id, section, prompt, helpText, type: "text", required };
}

export const AI_READINESS_LIGHT_QUESTIONS: ReadonlyArray<DiscoveryQuestion> = [
  // Leadership & strategy
  tier("AIL01", "Leadership", "Executive sponsorship / appetite for AI?", true),
  tier("AIL02", "Leadership", "Is there an AI strategy or stated objectives?"),
  single("AIL03", "Leadership", "Budget allocated for AI initiatives?", [
    { value: "yes", label: "Yes — funded" },
    { value: "exploring", label: "Exploring / unbudgeted" },
    { value: "no", label: "No" },
  ]),

  // Current usage
  multi("AIL04", "Current usage", "AI tools already used by staff", [
    { value: "copilot", label: "Microsoft Copilot" },
    { value: "chatgpt", label: "ChatGPT / Claude / Gemini" },
    { value: "embedded", label: "AI features in existing apps" },
    { value: "custom", label: "Custom / internal models" },
    { value: "none", label: "None" },
  ]),
  single("AIL05", "Current usage", "Is AI usage sanctioned or shadow?", [
    { value: "sanctioned", label: "Sanctioned + guided", weight: 2 },
    { value: "mixed", label: "Mixed", weight: 1 },
    { value: "shadow", label: "Mostly shadow / unmanaged", weight: 0 },
    { value: "none", label: "No usage yet", weight: 0 },
  ]),

  // Data readiness
  tier("AIL06", "Data", "Is business data organized & accessible?"),
  tier("AIL07", "Data", "Data quality / governance maturity?"),
  single("AIL08", "Data", "Where does most data live?", [
    { value: "cloud", label: "Cloud / SaaS" },
    { value: "hybrid", label: "Hybrid" },
    { value: "onprem", label: "On-prem / files" },
    { value: "scattered", label: "Scattered / siloed" },
  ]),

  // Governance & risk
  tier("AIL09", "Governance", "AI acceptable-use policy in place?"),
  tier("AIL10", "Governance", "Awareness of AI data-privacy / IP risk?"),
  single("AIL11", "Governance", "Regulatory exposure for AI use?", [
    { value: "high", label: "High (health, finance, legal)" },
    { value: "some", label: "Some" },
    { value: "low", label: "Low" },
  ]),

  // Skills
  tier("AIL12", "Skills", "Staff comfort / skills with AI tools?"),
  single("AIL13", "Skills", "Is anyone driving AI internally?", [
    { value: "champion", label: "Yes — a champion / team" },
    { value: "informal", label: "Informally" },
    { value: "no", label: "No one" },
  ]),

  // Use-cases & tooling
  multi("AIL14", "Use-cases", "Highest-interest use-cases", [
    { value: "productivity", label: "Employee productivity" },
    { value: "support", label: "Customer support" },
    { value: "sales", label: "Sales / marketing" },
    { value: "ops", label: "Operations / automation" },
    { value: "docs", label: "Document / knowledge search" },
    { value: "analytics", label: "Analytics / reporting" },
  ]),
  text("AIL15", "Use-cases", "Top 1–2 problems they hope AI can solve"),
  single("AIL16", "Tooling", "Microsoft 365 / Copilot licensing in place?", [
    { value: "yes", label: "Yes — eligible / licensed" },
    { value: "partial", label: "Partial" },
    { value: "no", label: "No" },
    { value: "unknown", label: "Unknown" },
  ]),
  tier("AIL17", "Tooling", "Foundational IT maturity to support AI (identity, security)?"),
  text("AIL18", "Wrap-up", "Anything else the vCIO should note for an AI roadmap"),
];

export const AI_READINESS_LIGHT_BANK: DiscoveryBank = {
  kind: "AI_READINESS_LIGHT",
  questions: AI_READINESS_LIGHT_QUESTIONS,
};
