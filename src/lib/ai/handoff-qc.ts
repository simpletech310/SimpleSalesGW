/**
 * v2.20 — Handoff quality check.
 *
 * Given a full Handoff row (decision-makers, commitments, contracts,
 * objections, success criteria, etc.), Claude returns a severity-tagged
 * findings report so the COO knows whether the handoff is safe to accept
 * or needs sales to fill gaps first.
 */

import { AiFeatureKind } from "@prisma/client";
import { claudeCompletion } from "@/lib/ai/anthropic";
import { loadProfile } from "@/lib/msp/loader";
import { renderMspProfileBlock } from "@/lib/msp/promptBlock";

export type HandoffQcSeverity = "blocking" | "warn" | "ok";

// v2.21 — company identity moved to the MSP profile block.
const TASK_INSTRUCTIONS = `## Your job
You are a sales-to-operations handoff quality auditor for the company
described above.

Review a structured handoff payload from sales to operations and flag
what's missing, contradictory, or risky BEFORE ops accepts it.
Operations needs decision-makers named, hard commitments tracked,
contracts referenced, and success criteria measurable — gaps here
cause onboarding failures.

Severity rules:
  - "blocking": cannot safely onboard without this — e.g. no executive sponsor named, no signed contracts listed, deal value missing on a non-zero quote, hard commitments with no SOW reference.
  - "warn": should be addressed but not a blocker — e.g. soft commitments without owner, success criteria without measurable targets, unresolved skeptics.
  - "ok": handoff is complete enough to accept.

Be specific in "issues" — reference the actual field that's wrong,
not generic statements. Suggestions should be concrete fixes the
salesperson can make in 5 minutes.

If the handoff promises a service that's in the Out-of-scope list of
the company profile above, flag it as "blocking" with a clear note —
we can't onboard what we don't deliver.

Output strictly as a single JSON object:
{
  "severity": "blocking" | "warn" | "ok",
  "issues": [
    { "field": "decisionMakers | hardCommitments | contractsSigned | budgetSnapshot | successCriteria | other", "concern": "what's wrong", "severity": "blocking | warn" }
  ],
  "suggestions": [
    "concrete one-line fix the salesperson can apply"
  ],
  "summary": "one-sentence overall judgment for the COO"
}`;

export type HandoffQcInput = {
  lead: {
    businessName: string;
    industry: string;
    seatCount: number | null;
    complianceDrivers: string[];
  };
  handoff: {
    dealValue: number | null;
    bundleId: string | null;
    complianceOverlay: string[];
    contractsSigned: string[];
    decisionMakers: unknown;
    hardCommitments: unknown;
    softCommitments: unknown;
    objectionsAndSkeptics: unknown;
    stakeholderContext: string | null;
    budgetSnapshot: unknown;
    successCriteria: unknown;
    notes: string | null;
  };
};

export type HandoffQcOutput = {
  severity: HandoffQcSeverity;
  issues: Array<{ field: string; concern: string; severity: "blocking" | "warn" }>;
  suggestions: string[];
  summary: string;
  raw: string;
};

function fmt(label: string, v: unknown): string {
  if (v == null) return `${label}: (empty)`;
  if (Array.isArray(v)) return `${label}: ${v.length === 0 ? "(empty)" : JSON.stringify(v, null, 2)}`;
  if (typeof v === "object") return `${label}: ${JSON.stringify(v, null, 2)}`;
  return `${label}: ${String(v)}`;
}

export async function checkHandoff(
  input: HandoffQcInput,
  budget: { leadId: string; userId?: string },
): Promise<HandoffQcOutput> {
  const lead = input.lead;
  const h = input.handoff;

  const ctx = [
    `Customer: ${lead.businessName} (${lead.industry}${lead.seatCount ? `, ${lead.seatCount} seats` : ""})`,
    lead.complianceDrivers.length > 0 ? `Lead-level compliance: ${lead.complianceDrivers.join(", ")}` : null,
    "",
    fmt("Deal value", h.dealValue),
    fmt("Bundle", h.bundleId),
    fmt("Compliance overlay", h.complianceOverlay),
    fmt("Contracts signed", h.contractsSigned),
    fmt("Decision makers", h.decisionMakers),
    fmt("Hard commitments", h.hardCommitments),
    fmt("Soft commitments", h.softCommitments),
    fmt("Objections / skeptics", h.objectionsAndSkeptics),
    fmt("Stakeholder context", h.stakeholderContext),
    fmt("Budget snapshot", h.budgetSnapshot),
    fmt("Success criteria", h.successCriteria),
    fmt("Notes", h.notes),
  ].filter((s) => s !== null).join("\n");

  const user = `HANDOFF PAYLOAD\n${ctx}`;
  const responseHint = `Return ONLY the JSON object — no markdown, no commentary.`;

  // v2.21 — assemble system prompt from MSP profile + task instructions.
  const profile = await loadProfile();
  const systemPrompt = `${renderMspProfileBlock(profile)}\n\n${TASK_INSTRUCTIONS}`;

  const { text } = await claudeCompletion({
    system: systemPrompt,
    user,
    responseHint,
    maxTokens: 1200,
    budget: { leadId: budget.leadId, userId: budget.userId, feature: AiFeatureKind.HANDOFF_QC },
  });

  let parsed: Partial<HandoffQcOutput> = {};
  try {
    const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned) as Partial<HandoffQcOutput>;
  } catch {
    parsed = { severity: "warn", issues: [], suggestions: [], summary: "(parse failure — see raw)" };
  }

  const severity: HandoffQcSeverity =
    parsed.severity === "blocking" || parsed.severity === "ok" ? parsed.severity : "warn";

  return {
    severity,
    issues: Array.isArray(parsed.issues)
      ? parsed.issues.map((i) => ({
          field: String((i as { field?: string }).field ?? "other"),
          concern: String((i as { concern?: string }).concern ?? ""),
          severity: (i as { severity?: string }).severity === "blocking" ? "blocking" : "warn",
        }))
      : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map((s) => String(s)) : [],
    summary: parsed.summary ?? "",
    raw: text,
  };
}
