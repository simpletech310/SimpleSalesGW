/**
 * v3.3 AI #6 — Detect trigger event from research notes.
 *
 * Scans pasted research / website summary / first-call notes for
 * signals that match a TriggerEvent enum value. Returns NONE if
 * nothing fires.
 */

import { z } from "zod";
import { AiFeatureKind } from "@prisma/client";
import { withBudgetedJson, type BudgetedJsonResult } from "./with-budget";

const TRIGGER_VALUES = [
  "NONE",
  "CYBER_INSURANCE_RENEWAL",
  "PEER_BREACH",
  "FEDERAL_CONTRACT_ANNOUNCEMENT",
  "MA_ACTIVITY",
  "CUSTOMER_CYBER_QUESTIONNAIRE",
  "COMPLIANCE_AUDIT",
  "MSP_DISSATISFACTION",
  "GROWTH_HIRING",
  "OTHER",
] as const;

const TASK = `## Your job
You are detecting the business event that prompted the salesperson to
pursue this lead. Read the RESEARCH NOTES and pick exactly one of:
${TRIGGER_VALUES.join(" | ")}

Use NONE only if no signal is present. Use OTHER when a trigger is
clearly present but doesn't match any enum value (and describe it in
the note).

Output strictly as JSON:
{
  "triggerEvent": "...",
  "triggerEventNote": "1 sentence explaining what you saw, or empty string for NONE",
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}`;

const TriggerSchema = z.object({
  triggerEvent: z.enum(TRIGGER_VALUES),
  triggerEventNote: z.string().default(""),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

export type TriggerEventOutput = z.infer<typeof TriggerSchema>;

export async function detectTriggerEvent(
  input: { researchNotes: string },
  budget?: { leadId?: string; userId?: string },
): Promise<BudgetedJsonResult<TriggerEventOutput>> {
  const user = `RESEARCH NOTES
${input.researchNotes || "(empty)"}`;

  return withBudgetedJson({
    systemTask: TASK,
    user,
    schema: TriggerSchema,
    feature: AiFeatureKind.TRIGGER_EVENT_DETECT,
    budget,
    maxTokens: 400,
  });
}
