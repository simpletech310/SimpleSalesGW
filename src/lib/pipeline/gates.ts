/**
 * Phase gates — config-driven advancement requirements.
 *
 * v2.3 ships warning-style gates: server returns `warnings: string[]` when
 * requirements aren't met, but does NOT block the transition. UI shows a
 * confirmation modal listing the missing items and lets the salesperson
 * proceed.
 *
 * Default gates:
 *   - LEAD       → QUALIFIED        : QualificationScorecard.total >= 30
 *   - DISCOVERY  → PRE_SALES        : at least one Assessment COMPLETED
 *   - PROPOSAL   → NEGOTIATION      : SOW SignedDocument exists (any status)
 *   - NEGOTIATION→ CLOSED_WON       : SOW + MSA SignedDocuments both SIGNED
 */

import { PipelineStage, SignedDocStatus, SignedDocType } from "@prisma/client";
import type { StageKey } from "@/lib/timeline/stages";
import { prisma } from "@/lib/prisma";

export type GateDefinition = {
  from: PipelineStage;
  to: PipelineStage;
  label: string;
  /** Async check returning `{ passed, note }` (note = human-readable reason on failure). */
  check: (leadId: string) => Promise<{ passed: boolean; note?: string }>;
};

async function qualificationOver30(leadId: string) {
  const q = await prisma.qualificationScorecard.findUnique({ where: { leadId }, select: { total: true } });
  const passed = (q?.total ?? 0) >= 30;
  return passed
    ? { passed: true }
    : { passed: false, note: `Qualification total is ${q?.total ?? 0}/100 — recommend ≥ 30 before advancing.` };
}

async function hasCompletedAssessment(leadId: string) {
  const count = await prisma.assessment.count({
    where: { leadId, status: "COMPLETED" },
  });
  return count > 0
    ? { passed: true }
    : { passed: false, note: "No completed assessment yet — recommend running the 25-question or self-service flow first." };
}

async function hasSowDocument(leadId: string) {
  const sow = await prisma.signedDocument.findFirst({
    where: { leadId, type: SignedDocType.SOW },
  });
  return sow
    ? { passed: true }
    : { passed: false, note: "No SOW document tracked — recommend uploading the SOW before NEGOTIATION." };
}

async function sowAndMsaSigned(leadId: string) {
  const sow = await prisma.signedDocument.findFirst({ where: { leadId, type: SignedDocType.SOW, status: SignedDocStatus.SIGNED } });
  const msa = await prisma.signedDocument.findFirst({ where: { leadId, type: SignedDocType.MSA, status: SignedDocStatus.SIGNED } });
  const missing: string[] = [];
  if (!sow) missing.push("SOW SIGNED");
  if (!msa) missing.push("MSA SIGNED");
  return missing.length === 0
    ? { passed: true }
    : { passed: false, note: `Missing signed contracts: ${missing.join(", ")}.` };
}

export const GATES: ReadonlyArray<GateDefinition> = [
  { from: PipelineStage.LEAD, to: PipelineStage.QUALIFIED, label: "Qualification ≥ 30", check: qualificationOver30 },
  // v3.3.22 — new MSP-friendly transitions. Old PROPOSAL/PRE_SALES gates
  // stay so legacy leads keep evaluating; new ones cover the new flow.
  { from: PipelineStage.DISCOVERY, to: PipelineStage.QUOTE_IN_PROGRESS, label: "Assessment completed", check: hasCompletedAssessment },
  { from: PipelineStage.DISCOVERY, to: PipelineStage.PRE_SALES, label: "Assessment completed", check: hasCompletedAssessment },
  { from: PipelineStage.QUOTE_SENT, to: PipelineStage.NEGOTIATION, label: "SOW tracked", check: hasSowDocument },
  { from: PipelineStage.PROPOSAL, to: PipelineStage.NEGOTIATION, label: "SOW tracked", check: hasSowDocument },
  { from: PipelineStage.NEGOTIATION, to: PipelineStage.CLOSED_WON, label: "SOW + MSA signed", check: sowAndMsaSigned },
];

/**
 * Run the single gate (if any) governing the requested transition.
 * Returns `warnings: []` when no gate applies or the gate passes.
 */
export async function evaluateGate(leadId: string, from: PipelineStage, to: PipelineStage): Promise<{ warnings: string[] }> {
  const gate = GATES.find((g) => g.from === from && g.to === to);
  if (!gate) return { warnings: [] };
  const result = await gate.check(leadId);
  if (result.passed) return { warnings: [] };
  return { warnings: [result.note ?? `Gate "${gate.label}" not satisfied.`] };
}

/**
 * Evaluate every defined gate against the current lead state. Used by the
 * timeline view to render gate icons (passed/blocked) on each transition.
 */
export async function evaluateAllGates(leadId: string): Promise<Partial<Record<StageKey, { passed: boolean; note?: string }>>> {
  const out: Partial<Record<StageKey, { passed: boolean; note?: string }>> = {};
  await Promise.all(
    GATES.map(async (g) => {
      const r = await g.check(leadId);
      out[`pipeline:${g.from}`] = r;
    }),
  );
  return out;
}
