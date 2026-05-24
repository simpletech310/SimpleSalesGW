/**
 * v2.17 — Voice pre-sale scoping → quote-ready line items.
 *
 * Translates the salesperson's answers from VOICE_SCOPING_QUESTIONS into
 * a recommendedLineItems[] array that mirrors src/lib/pricing/deal-kinds.ts
 * `LineItem` shape, so the PreSaleAssessmentPanel can offer "Adopt N
 * items into quote" — a single click that prefills the ServiceQuoteCard.
 */

import { LINE_ITEM_STICKERS, type LineItem } from "@/lib/pricing/deal-kinds";

export type VoiceScopingScorecard = {
  kind: "VOICE_SCOPING";
  summary: string;
  findings: string[];
  risks: Array<{ severity: "high" | "medium" | "low"; description: string }>;
  recommendedActions: string[];
  recommendedLineItems: LineItem[];
  coveragePct: number;
};

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}
function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === "yes";
}
function pickStringMulti(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  return [];
}

export function scoreVoiceScoping(answers: Record<string, unknown>): VoiceScopingScorecard {
  const total = asNumber(answers.V04);
  const desk = asNumber(answers.V05);
  const softphone = asNumber(answers.V06);
  const conf = asNumber(answers.V07);

  // Defaults if the salesperson didn't break out desk vs softphone.
  const handsetCount = desk > 0 || softphone > 0
    ? desk + conf
    : Math.max(0, total - softphone) + conf;

  const recommendedLineItems: LineItem[] = [];

  if (total > 0) {
    // Per-extension MRR
    recommendedLineItems.push({
      kind: "VOICE_EXTENSION",
      label: LINE_ITEM_STICKERS.VOICE_EXTENSION.label,
      qty: total,
      perUnitMrr: LINE_ITEM_STICKERS.VOICE_EXTENSION.perUnitMrr,
      perUnitOneTime: LINE_ITEM_STICKERS.VOICE_EXTENSION.perUnitOneTime,
    });
  }

  if (handsetCount > 0) {
    recommendedLineItems.push({
      kind: "VOICE_HARDWARE",
      label: LINE_ITEM_STICKERS.VOICE_HARDWARE.label,
      qty: handsetCount,
      perUnitMrr: LINE_ITEM_STICKERS.VOICE_HARDWARE.perUnitMrr,
      perUnitOneTime: LINE_ITEM_STICKERS.VOICE_HARDWARE.perUnitOneTime,
    });
  }

  // Conference phones are pricier — flag with a free-text OTHER line.
  if (conf > 0 && asBool(answers.V16)) {
    recommendedLineItems.push({
      kind: "OTHER",
      label: "Conference / boardroom phones",
      qty: conf,
      perUnitMrr: 0,
      perUnitOneTime: 850,
    });
  }

  // Install labor — heuristic: 0.5 hr per handset, min 4 hrs.
  const laborHours = Math.max(4, Math.ceil(handsetCount * 0.5));
  if (laborHours > 0) {
    recommendedLineItems.push({
      kind: "INSTALL_LABOR",
      label: LINE_ITEM_STICKERS.INSTALL_LABOR.label,
      qty: laborHours,
      perUnitMrr: 0,
      perUnitOneTime: LINE_ITEM_STICKERS.INSTALL_LABOR.perUnitOneTime,
    });
  }

  // Findings + risks
  const findings: string[] = [];
  const risks: VoiceScopingScorecard["risks"] = [];
  const recommendedActions: string[] = [];

  if (total > 0) findings.push(`Total extensions: ${total} (${desk || total - softphone} desk + ${softphone} softphone + ${conf} conference).`);

  const routing = pickStringMulti(answers.V11);
  if (routing.length > 0) findings.push(`Routing needs: ${routing.join(", ")}.`);

  const qosAnswer = String(answers.V18 ?? "");
  if (qosAnswer === "no" || qosAnswer === "unsure") {
    risks.push({
      severity: "high",
      description: "QoS / voice VLAN not in place. Cutover-day call quality risk.",
    });
    recommendedActions.push("Schedule a network walk before cutover to set up QoS + voice VLAN.");
  }
  const bandwidth = String(answers.V19 ?? "");
  if (bandwidth === "cable_only" || bandwidth === "unknown") {
    risks.push({
      severity: "medium",
      description: "Single non-fiber circuit — call quality may degrade under load.",
    });
    recommendedActions.push("Discuss internet uplift or failover circuit with the customer.");
  }

  if (asBool(answers.V20)) {
    findings.push("e911 / Kari's Law location reporting required.");
    recommendedActions.push("Confirm dynamic 911 location reporting is provisioned per site.");
  }
  if (asBool(answers.V21)) {
    findings.push("Call recording required.");
    recommendedActions.push("Verify call-recording compliance posture (1- vs 2-party consent state).");
  }
  if (asBool(answers.V22)) {
    const crm = String(answers.V23 ?? "the chosen CRM");
    findings.push(`CRM integration with ${crm} requested.`);
    recommendedActions.push(`Confirm ${crm} API access + verify supported PBX connector.`);
  }
  if (asBool(answers.V24)) {
    findings.push("Analog devices need to be preserved (paging / intercom / elevator).");
    recommendedActions.push("Scope ATA gateways or analog ports per legacy device.");
  }

  const v25 = String(answers.V25 ?? "").trim();
  if (v25) findings.push(`Install notes: ${v25}`);

  // Coverage
  const filled = Object.values(answers).filter((v) => v !== "" && v != null && !(Array.isArray(v) && v.length === 0)).length;
  const coveragePct = Math.round((filled / 25) * 100);

  const summary = total > 0
    ? `${total}-extension VoIP quote ready (${handsetCount} handsets, ${laborHours}h labor).`
    : "Quote skeleton — extension count not entered yet.";

  return {
    kind: "VOICE_SCOPING",
    summary,
    findings,
    risks,
    recommendedActions,
    recommendedLineItems,
    coveragePct,
  };
}
