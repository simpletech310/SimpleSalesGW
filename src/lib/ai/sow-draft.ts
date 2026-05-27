/**
 * v3.3 AI #1 — SOW draft.
 *
 * Reads a SowTemplate skeleton + the lead's context (industry, seats,
 * pain, compliance) + completed discovery + approved pricing snapshot,
 * and returns the five filled markdown sections plus an array of
 * assumptions the rep should verify before sending.
 */

import { z } from "zod";
import { AiFeatureKind } from "@prisma/client";
import { withBudgetedJson, type BudgetedJsonResult } from "./with-budget";

const TASK = `## Your job
You are drafting a Statement of Work for the company described above.
Use the SOW TEMPLATE provided as the skeleton — replace every {{merge_field}}
with concrete content tailored to the lead. Adjust phrasing to fit the
lead's industry, seat count, and stated pain. Keep the company's brand
voice from the preamble.

Output strictly as a single JSON object:
{
  "scopeMarkdown":        "...",
  "deliverablesMarkdown": "...",
  "timelineMarkdown":     "...",
  "exclusionsMarkdown":   "...",
  "termsMarkdown":        "...",
  "assumptions": ["assumption rep should verify", ...],
  "notes": "1-2 sentence overview of what changed from the template"
}

Never invent compliance commitments, dollar figures, or hardware counts
not present in the discovery + pricing snapshot. When discovery is thin,
keep wording conservative and add the gap to "assumptions".`;

const SowDraftSchema = z.object({
  scopeMarkdown: z.string(),
  deliverablesMarkdown: z.string(),
  timelineMarkdown: z.string(),
  exclusionsMarkdown: z.string(),
  termsMarkdown: z.string(),
  assumptions: z.array(z.string()).default([]),
  notes: z.string().default(""),
});

export type SowDraftOutput = z.infer<typeof SowDraftSchema>;

export type SowDraftInput = {
  lead: {
    businessName: string;
    industry: string;
    seatCount: number | null;
    siteCount: number;
    complianceDrivers: string[];
    statedPain?: string | null;
    triggerEvent?: string | null;
  };
  template: {
    name: string;
    scopeMarkdown: string;
    deliverablesMarkdown: string;
    timelineMarkdown: string;
    exclusionsMarkdown: string;
    termsMarkdown: string;
  };
  discovery: Array<{ kind: string; summary: string }>;
  pricingSnapshot: Record<string, unknown>;
};

export async function draftSow(
  input: SowDraftInput,
  budget?: { leadId: string; userId?: string },
): Promise<BudgetedJsonResult<SowDraftOutput>> {
  const ctx = [
    `LEAD: ${input.lead.businessName} (${input.lead.industry})`,
    input.lead.seatCount ? `Seats: ${input.lead.seatCount} across ${input.lead.siteCount} site(s)` : null,
    input.lead.complianceDrivers.length ? `Compliance: ${input.lead.complianceDrivers.join(", ")}` : null,
    input.lead.statedPain ? `Stated pain: ${input.lead.statedPain}` : null,
    input.lead.triggerEvent && input.lead.triggerEvent !== "NONE" ? `Trigger event: ${input.lead.triggerEvent}` : null,
  ].filter(Boolean).join("\n");

  const discoveryBlock = input.discovery.length === 0
    ? "(no discovery yet)"
    : input.discovery.map((d) => `- ${d.kind}: ${d.summary}`).join("\n");

  const user = `${ctx}

DISCOVERY
${discoveryBlock}

APPROVED PRICING SNAPSHOT
${JSON.stringify(input.pricingSnapshot, null, 2)}

SOW TEMPLATE: ${input.template.name}
## scope
${input.template.scopeMarkdown}

## deliverables
${input.template.deliverablesMarkdown}

## timeline
${input.template.timelineMarkdown}

## exclusions
${input.template.exclusionsMarkdown}

## terms
${input.template.termsMarkdown}`;

  return withBudgetedJson({
    systemTask: TASK,
    user,
    schema: SowDraftSchema,
    feature: AiFeatureKind.SOW_DRAFT,
    budget,
    maxTokens: 4000,
  });
}

// ---------- v3.4 — single-section regenerate ----------

const SECTION_LABEL: Record<SowSection, string> = {
  scope: "Scope",
  deliverables: "Deliverables",
  timeline: "Timeline",
  exclusions: "Exclusions",
  terms: "Terms",
};

export type SowSection = "scope" | "deliverables" | "timeline" | "exclusions" | "terms";

const SectionRegenSchema = z.object({
  markdown: z.string().min(1),
  notes: z.string().default(""),
});
export type SowSectionRegenOutput = z.infer<typeof SectionRegenSchema>;

export type SowSectionRegenInput = SowDraftInput & {
  section: SowSection;
  currentDraft: {
    scopeMarkdown: string;
    deliverablesMarkdown: string;
    timelineMarkdown: string;
    exclusionsMarkdown: string;
    termsMarkdown: string;
  };
  instruction: string;
};

export async function regenerateSection(
  input: SowSectionRegenInput,
  budget?: { leadId: string; userId?: string },
): Promise<BudgetedJsonResult<SowSectionRegenOutput>> {
  const sectionLabel = SECTION_LABEL[input.section];
  const sectionTask = `## Your job
You are rewriting the **${sectionLabel}** section of an existing Statement of Work.
Apply the user's refinement instruction below while preserving the rest of the
SOW intact. Do not invent compliance commitments, dollar figures, or hardware
counts that are not present in the discovery + pricing snapshot.

User instruction: ${input.instruction}

Output strictly as a single JSON object:
{
  "markdown": "rewritten markdown for the ${sectionLabel} section only",
  "notes": "1 sentence on what you changed"
}`;

  const ctx = [
    `LEAD: ${input.lead.businessName} (${input.lead.industry})`,
    input.lead.seatCount ? `Seats: ${input.lead.seatCount} across ${input.lead.siteCount} site(s)` : null,
    input.lead.complianceDrivers.length ? `Compliance: ${input.lead.complianceDrivers.join(", ")}` : null,
    input.lead.statedPain ? `Stated pain: ${input.lead.statedPain}` : null,
  ].filter(Boolean).join("\n");

  const discoveryBlock = input.discovery.length === 0
    ? "(no discovery yet)"
    : input.discovery.map((d) => `- ${d.kind}: ${d.summary}`).join("\n");

  const user = `${ctx}

DISCOVERY
${discoveryBlock}

APPROVED PRICING SNAPSHOT
${JSON.stringify(input.pricingSnapshot, null, 2)}

CURRENT FULL DRAFT
## scope
${input.currentDraft.scopeMarkdown}

## deliverables
${input.currentDraft.deliverablesMarkdown}

## timeline
${input.currentDraft.timelineMarkdown}

## exclusions
${input.currentDraft.exclusionsMarkdown}

## terms
${input.currentDraft.termsMarkdown}

Rewrite only the ${sectionLabel.toUpperCase()} section.`;

  return withBudgetedJson({
    systemTask: sectionTask,
    user,
    schema: SectionRegenSchema,
    feature: AiFeatureKind.SOW_DRAFT,
    budget,
    maxTokens: 1500,
  });
}
