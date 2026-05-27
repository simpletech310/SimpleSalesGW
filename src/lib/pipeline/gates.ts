/**
 * Phase gates — advancement requirements between pipeline stages.
 *
 * Two flavors of gate:
 *   - Hard block: required data is missing, no override possible. API returns 422.
 *   - Soft warning: recommendation only. API returns 409 with warnings the
 *     salesperson can acknowledge to proceed.
 *
 * Canonical 10-stage flow (v3.4):
 *   LEAD → QUALIFIED → FIRST_INTERACTION → SITE_SURVEY_SCHEDULED →
 *   DISCOVERY → QUOTE_IN_PROGRESS → QUOTE_SENT → NEGOTIATION →
 *   CLOSED_WON / CLOSED_LOST
 */

import { PipelineStage, ProposalStatus, SignedDocStatus, SignedDocType } from "@prisma/client";
import type { StageKey } from "@/lib/timeline/stages";
import { prisma } from "@/lib/prisma";

export type GateResult = { passed: boolean; note?: string };

export type GateDefinition = {
  from: PipelineStage;
  to: PipelineStage;
  label: string;
  kind: "hard" | "warning";
  /** Async check returning `{ passed, note }`. */
  check: (leadId: string) => Promise<GateResult>;
};

// ---------- Hard-block checks ----------

async function leadQualifiedRequiredFields(leadId: string): Promise<GateResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      industry: true,
      seatCount: true,
      siteCount: true,
      interestedServices: true,
      primaryContactName: true,
      primaryContactEmail: true,
      primaryContactPhone: true,
    },
  });
  if (!lead) return { passed: false, note: "Lead not found." };
  const missing: string[] = [];
  if (!lead.industry) missing.push("industry");
  if (lead.seatCount == null) missing.push("seat count");
  if (lead.siteCount == null) missing.push("site count");
  if (!lead.interestedServices?.length) missing.push("services of interest");
  if (!lead.primaryContactName) missing.push("primary contact name");
  if (!lead.primaryContactEmail && !lead.primaryContactPhone) missing.push("primary contact email or phone");
  return missing.length === 0
    ? { passed: true }
    : { passed: false, note: `Required for Qualified: ${missing.join(", ")}.` };
}

async function hasOutreachActivity(leadId: string): Promise<GateResult> {
  const count = await prisma.activity.count({
    where: {
      leadId,
      type: { in: ["CALL", "EMAIL", "MEETING", "SMS", "LINKEDIN"] as never },
    },
  });
  return count > 0
    ? { passed: true }
    : { passed: false, note: "Log at least one outreach activity (call, email, or meeting) before advancing." };
}

async function siteSurveyReadyForVcio(leadId: string): Promise<GateResult> {
  const survey = await prisma.siteSurvey.findUnique({
    where: { leadId },
    select: {
      scheduledDate: true,
      scheduledStart: true,
      pocName: true,
      pocTitle: true,
      pocEmail: true,
      pocPhone: true,
      pocCanAuthorize: true,
      clientType: true,
      status: true,
    },
  });
  if (!survey) {
    return {
      passed: false,
      note: "Schedule the site survey first: open the lead and fill the Site Survey panel (POC, decision-maker, date/time, client type).",
    };
  }
  const missing: string[] = [];
  if (!survey.scheduledDate) missing.push("scheduled date");
  if (!survey.scheduledStart) missing.push("scheduled time");
  if (!survey.pocName) missing.push("POC name");
  if (!survey.pocTitle) missing.push("POC title");
  if (!survey.pocEmail) missing.push("POC email");
  if (!survey.pocPhone) missing.push("POC phone");
  if (!survey.pocCanAuthorize) missing.push("confirmation POC can authorize decisions");
  if (!survey.clientType) missing.push("client type (IT / Access Control / CCTV / Mixed)");
  return missing.length === 0
    ? { passed: true }
    : { passed: false, note: `Site survey incomplete: ${missing.join(", ")}.` };
}

async function siteSurveyAcceptedByVcio(leadId: string): Promise<GateResult> {
  const survey = await prisma.siteSurvey.findUnique({
    where: { leadId },
    select: { vcioAcceptedAt: true, status: true, vcioRejectReason: true },
  });
  if (!survey) {
    return { passed: false, note: "No site survey on file — go back and schedule the assessment first." };
  }
  if (survey.status === "REJECTED") {
    return {
      passed: false,
      note: `vCIO rejected this site survey${survey.vcioRejectReason ? `: ${survey.vcioRejectReason}` : ""}. Update the survey and resubmit.`,
    };
  }
  if (!survey.vcioAcceptedAt) {
    return { passed: false, note: "Waiting on vCIO to accept the site survey before moving to Discovery." };
  }
  return { passed: true };
}

async function discoveryVerifiedAndAssessed(leadId: string): Promise<GateResult> {
  const [survey, assessmentCount] = await Promise.all([
    prisma.siteSurvey.findUnique({
      where: { leadId },
      select: { discoveryVerifiedAt: true, verifiedSeatCount: true, verifiedSiteCount: true },
    }),
    prisma.assessment.count({ where: { leadId, status: "COMPLETED" } }),
  ]);
  const missing: string[] = [];
  if (!survey?.discoveryVerifiedAt) missing.push("vCIO must verify seat + site counts on the site survey");
  if (assessmentCount === 0) missing.push("at least one assessment must be COMPLETED");
  return missing.length === 0
    ? { passed: true }
    : { passed: false, note: missing.join("; ") };
}

async function approvedProposalExists(leadId: string): Promise<GateResult> {
  const proposal = await prisma.proposal.findFirst({
    where: { leadId, status: ProposalStatus.APPROVED },
    select: { id: true },
  });
  return proposal
    ? { passed: true }
    : { passed: false, note: "Approve a proposal (vCIO + manager review) before marking the quote sent." };
}

async function sowAndMsaSigned(leadId: string): Promise<GateResult> {
  const [sow, msa] = await Promise.all([
    prisma.signedDocument.findFirst({ where: { leadId, type: SignedDocType.SOW, status: SignedDocStatus.SIGNED } }),
    prisma.signedDocument.findFirst({ where: { leadId, type: SignedDocType.MSA, status: SignedDocStatus.SIGNED } }),
  ]);
  const missing: string[] = [];
  if (!sow) missing.push("SOW SIGNED");
  if (!msa) missing.push("MSA SIGNED");
  return missing.length === 0
    ? { passed: true }
    : { passed: false, note: `Missing signed contracts: ${missing.join(", ")}.` };
}

async function closedLostReasonPresent(leadId: string): Promise<GateResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { closedLostReason: true } });
  return lead?.closedLostReason
    ? { passed: true }
    : { passed: false, note: "Loss reason is required before marking the deal Closed Lost." };
}

// ---------- Soft warning checks ----------

async function qualificationOver30(leadId: string): Promise<GateResult> {
  const q = await prisma.qualificationScorecard.findUnique({ where: { leadId }, select: { total: true } });
  const passed = (q?.total ?? 0) >= 30;
  return passed
    ? { passed: true }
    : { passed: false, note: `Qualification total is ${q?.total ?? 0}/100 — recommend ≥ 30 before advancing.` };
}

async function hasSowDocument(leadId: string): Promise<GateResult> {
  const sow = await prisma.signedDocument.findFirst({ where: { leadId, type: SignedDocType.SOW } });
  return sow
    ? { passed: true }
    : { passed: false, note: "No SOW tracked yet — recommend uploading the SOW before NEGOTIATION." };
}

// Gates evaluated for every move into CLOSED_LOST regardless of source stage.
const CLOSED_LOST_GATES: GateDefinition[] = (
  [
    PipelineStage.LEAD,
    PipelineStage.QUALIFIED,
    PipelineStage.FIRST_INTERACTION,
    PipelineStage.SITE_SURVEY_SCHEDULED,
    PipelineStage.DISCOVERY,
    PipelineStage.QUOTE_IN_PROGRESS,
    PipelineStage.QUOTE_SENT,
    PipelineStage.NEGOTIATION,
  ] as const
).map((from) => ({
  from,
  to: PipelineStage.CLOSED_LOST,
  label: "Loss reason required",
  kind: "hard" as const,
  check: closedLostReasonPresent,
}));

export const GATES: ReadonlyArray<GateDefinition> = [
  // Hard blocks
  { from: PipelineStage.LEAD, to: PipelineStage.QUALIFIED, label: "Qualified required fields", kind: "hard", check: leadQualifiedRequiredFields },
  { from: PipelineStage.QUALIFIED, to: PipelineStage.FIRST_INTERACTION, label: "Outreach logged", kind: "hard", check: hasOutreachActivity },
  { from: PipelineStage.FIRST_INTERACTION, to: PipelineStage.SITE_SURVEY_SCHEDULED, label: "Site survey scheduled", kind: "hard", check: siteSurveyReadyForVcio },
  { from: PipelineStage.SITE_SURVEY_SCHEDULED, to: PipelineStage.DISCOVERY, label: "vCIO accepted site survey", kind: "hard", check: siteSurveyAcceptedByVcio },
  { from: PipelineStage.DISCOVERY, to: PipelineStage.QUOTE_IN_PROGRESS, label: "Discovery verified", kind: "hard", check: discoveryVerifiedAndAssessed },
  { from: PipelineStage.QUOTE_IN_PROGRESS, to: PipelineStage.QUOTE_SENT, label: "Approved proposal exists", kind: "hard", check: approvedProposalExists },
  { from: PipelineStage.NEGOTIATION, to: PipelineStage.CLOSED_WON, label: "SOW + MSA signed", kind: "hard", check: sowAndMsaSigned },
  ...CLOSED_LOST_GATES,
  // Soft warnings (advisory only)
  { from: PipelineStage.LEAD, to: PipelineStage.QUALIFIED, label: "Qualification ≥ 30", kind: "warning", check: qualificationOver30 },
  { from: PipelineStage.QUOTE_SENT, to: PipelineStage.NEGOTIATION, label: "SOW tracked", kind: "warning", check: hasSowDocument },
];

/**
 * Run every gate (hard + soft) governing the requested transition.
 * Returns:
 *   - `hardBlocks` — array of reasons the move must be rejected.
 *   - `warnings`  — advisory notes the salesperson can acknowledge.
 */
export async function evaluateGate(
  leadId: string,
  from: PipelineStage,
  to: PipelineStage,
): Promise<{ warnings: string[]; hardBlocks: string[] }> {
  const applicable = GATES.filter((g) => g.from === from && g.to === to);
  if (applicable.length === 0) return { warnings: [], hardBlocks: [] };
  const results = await Promise.all(
    applicable.map(async (g) => ({ gate: g, result: await g.check(leadId) })),
  );
  const warnings: string[] = [];
  const hardBlocks: string[] = [];
  for (const { gate, result } of results) {
    if (result.passed) continue;
    const note = result.note ?? `Gate "${gate.label}" not satisfied.`;
    (gate.kind === "hard" ? hardBlocks : warnings).push(note);
  }
  return { warnings, hardBlocks };
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
      // First gate per stage wins; hard-block failures override warning passes.
      const key = `pipeline:${g.from}` as StageKey;
      if (!out[key] || (out[key]?.passed && !r.passed)) out[key] = r;
    }),
  );
  return out;
}
