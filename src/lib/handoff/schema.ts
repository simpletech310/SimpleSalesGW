/**
 * Structured Sales-to-Ops Handoff schema (v2.3).
 *
 * Mirrors the paper 04_Sales_to_Ops_Handoff_Checklist.md 1:1 so the digital
 * handoff carries every field Ops needs to take the engagement without
 * re-discovering it. Replaces the v1 freeform `payload` JSON.
 */

import { ServiceBundle } from "@prisma/client";
import { z } from "zod";

// ---------------------------------------------------------------------------
// JSON sub-schemas
// ---------------------------------------------------------------------------

export const decisionMakerSchema = z.object({
  name:        z.string().min(1).max(200),
  role:        z.string().max(200).optional(),
  authority:   z.enum(["FINAL", "ECONOMIC", "TECHNICAL", "INFLUENCER", "BLOCKER"]).optional(),
  temperature: z.enum(["CHAMPION", "SUPPORTIVE", "NEUTRAL", "SKEPTICAL", "OPPOSED"]).optional(),
  comms:       z.string().max(400).optional(),  // preferred comms channel / cadence notes
});
export type DecisionMaker = z.infer<typeof decisionMakerSchema>;

export const commitmentSchema = z.object({
  text:     z.string().min(1).max(600),
  sowRef:   z.string().max(80).optional(),       // e.g. "SOW §3.2"
  deadline: z.string().optional(),                // ISO date or natural-language deadline
});
export type Commitment = z.infer<typeof commitmentSchema>;

export const objectionSkepticSchema = z.object({
  name:    z.string().max(200).optional(),
  concern: z.string().min(1).max(600),
  status:  z.enum(["UNRESOLVED", "ADDRESSED", "WATCH"]).optional(),
});
export type ObjectionSkeptic = z.infer<typeof objectionSkepticSchema>;

export const budgetSnapshotSchema = z.object({
  status: z.enum(["APPROVED", "BEING_PLANNED", "INFORMAL", "UNKNOWN"]),
  range:  z.string().max(200).optional(),         // e.g. "$8-12k MRR"
  notes:  z.string().max(2000).optional(),
});
export type BudgetSnapshot = z.infer<typeof budgetSnapshotSchema>;

export const successCriterionSchema = z.object({
  metric: z.string().min(1).max(200),
  target: z.string().max(200).optional(),
  owner:  z.string().max(200).optional(),
});
export type SuccessCriterion = z.infer<typeof successCriterionSchema>;

// ---------------------------------------------------------------------------
// Top-level handoff initiate schema
// ---------------------------------------------------------------------------

export const handoffInitiateSchema = z.object({
  leadId: z.string().uuid(),

  // Deal facts
  dealValue:          z.coerce.number().nonnegative().optional(),
  bundleId:           z.nativeEnum(ServiceBundle).optional(),
  complianceOverlay:  z.array(z.string().max(60)).max(20).optional(),
  contractsSigned:    z.array(z.string().max(120)).max(20).optional(),

  // Stakeholder map (up to 5 decision makers)
  decisionMakers:        z.array(decisionMakerSchema).max(5).optional(),
  stakeholderContext:    z.string().max(8000).optional(),

  // Commitments
  hardCommitments:       z.array(commitmentSchema).max(50).optional(),
  softCommitments:       z.array(commitmentSchema).max(50).optional(),

  // Objections + skeptics
  objectionsAndSkeptics: z.array(objectionSkepticSchema).max(50).optional(),

  // Budget snapshot
  budgetSnapshot:        budgetSnapshotSchema.optional(),

  // Success criteria
  successCriteria:       z.array(successCriterionSchema).max(20).optional(),

  // Free-form notes
  notes:                 z.string().max(20_000).optional(),
});

export type HandoffInitiate = z.infer<typeof handoffInitiateSchema>;

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const AUTHORITY_LABEL: Record<NonNullable<DecisionMaker["authority"]>, string> = {
  FINAL:       "Final say",
  ECONOMIC:    "Economic buyer",
  TECHNICAL:   "Technical buyer",
  INFLUENCER:  "Influencer",
  BLOCKER:     "Potential blocker",
};

export const TEMPERATURE_LABEL: Record<NonNullable<DecisionMaker["temperature"]>, string> = {
  CHAMPION:    "Champion",
  SUPPORTIVE:  "Supportive",
  NEUTRAL:     "Neutral",
  SKEPTICAL:   "Skeptical",
  OPPOSED:     "Opposed",
};

export const BUDGET_STATUS_LABEL: Record<BudgetSnapshot["status"], string> = {
  APPROVED:      "Approved",
  BEING_PLANNED: "Being planned",
  INFORMAL:      "Informal / verbal",
  UNKNOWN:       "Unknown",
};

export const OBJECTION_STATUS_LABEL: Record<NonNullable<ObjectionSkeptic["status"]>, string> = {
  UNRESOLVED: "Unresolved",
  ADDRESSED:  "Addressed",
  WATCH:      "Watch",
};
