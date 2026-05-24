/**
 * v2.17 — Access-control pre-sale scoping → quote-ready line items.
 */

import { LINE_ITEM_STICKERS, type LineItem } from "@/lib/pricing/deal-kinds";

export type AccessControlScopingScorecard = {
  kind: "ACCESS_CONTROL_SCOPING";
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
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

export function scoreAccessControlScoping(answers: Record<string, unknown>): AccessControlScopingScorecard {
  const doors = asNumber(answers.A04);
  const exterior = asNumber(answers.A05);
  const interior = asNumber(answers.A06);
  const cardholders = asNumber(answers.A13);
  const groups = asNumber(answers.A14);

  const existingHardware = pickStringMulti(answers.A09);
  const hasExistingHardware = existingHardware.length > 0 && !existingHardware.includes("none");
  const needsPower = !asBool(answers.A10);
  const needsCabling = !asBool(answers.A11);

  const recommendedLineItems: LineItem[] = [];

  if (doors > 0) {
    // Per-door reader + software licensing
    recommendedLineItems.push({
      kind: "DOOR_READER",
      label: LINE_ITEM_STICKERS.DOOR_READER.label,
      qty: doors,
      perUnitMrr: LINE_ITEM_STICKERS.DOOR_READER.perUnitMrr,
      perUnitOneTime: LINE_ITEM_STICKERS.DOOR_READER.perUnitOneTime,
    });
  }

  // Door hardware kit for doors that need it
  if (!hasExistingHardware && doors > 0) {
    recommendedLineItems.push({
      kind: "OTHER",
      label: "Door hardware kit (strike + REX + contact)",
      qty: doors,
      perUnitMrr: 0,
      perUnitOneTime: 450,
    });
  }

  // Install labor: 4 hrs per exterior door (cabling + termination), 2 hrs per interior
  const baseLabor = exterior * 4 + interior * 2;
  const cablingBump = needsCabling ? doors * 2 : 0;
  const powerBump = needsPower ? doors * 1 : 0;
  const labor = Math.max(4, baseLabor + cablingBump + powerBump);
  if (labor > 0 && doors > 0) {
    recommendedLineItems.push({
      kind: "INSTALL_LABOR",
      label: LINE_ITEM_STICKERS.INSTALL_LABOR.label,
      qty: labor,
      perUnitMrr: 0,
      perUnitOneTime: LINE_ITEM_STICKERS.INSTALL_LABOR.perUnitOneTime,
    });
  }

  // Per-cardholder credential cost
  if (cardholders > 0) {
    const credentialType = String(answers.A12 ?? "");
    let unitCost = 5;
    if (credentialType === "card_smart") unitCost = 8;
    else if (credentialType === "mobile") unitCost = 6;
    else if (credentialType === "biometric") unitCost = 0; // no physical credential
    if (unitCost > 0) {
      recommendedLineItems.push({
        kind: "OTHER",
        label: `Credentials (${credentialType.replace(/_/g, " ")})`,
        qty: cardholders,
        perUnitMrr: 0,
        perUnitOneTime: unitCost,
      });
    }
  }

  const findings: string[] = [];
  const risks: AccessControlScopingScorecard["risks"] = [];
  const recommendedActions: string[] = [];

  if (doors > 0) {
    findings.push(`${doors} controlled doors (${exterior} exterior, ${interior} interior).`);
  }
  if (cardholders > 0) {
    findings.push(`${cardholders} cardholders across ${groups || 1} access group${groups === 1 ? "" : "s"}.`);
  }

  if (needsPower) {
    risks.push({ severity: "medium", description: "Power not at every door — electrician coordination required." });
    recommendedActions.push("Schedule low-voltage electrician for door-power runs.");
  }
  if (needsCabling) {
    risks.push({ severity: "medium", description: "Cabling not in place — full new runs to each reader." });
  }
  if (!hasExistingHardware) {
    findings.push("No existing door hardware — full kit needed (strike + REX + contact) per door.");
  }

  const compliance = pickStringMulti(answers.A20);
  if (compliance.length > 0 && !compliance.includes("none")) {
    findings.push(`Compliance drivers: ${compliance.join(", ")}.`);
    recommendedActions.push("Confirm audit-log retention required by the listed frameworks before final SOW.");
  }
  if (asBool(answers.A21)) recommendedActions.push("Confirm reporting cadence + delivery method (email vs portal export).");
  if (asBool(answers.A22)) recommendedActions.push("Configure alerting destinations (email, SMS, integration with monitoring).");

  if (asBool(answers.A23)) {
    findings.push("Building occupied during install — after-hours scheduling needed.");
    recommendedActions.push("Build after-hours labor surcharge into the quote.");
  }

  const filled = Object.values(answers).filter((v) => v !== "" && v != null && !(Array.isArray(v) && v.length === 0)).length;
  const coveragePct = Math.round((filled / 25) * 100);

  const summary = doors > 0
    ? `${doors}-door access-control quote with ${cardholders || "?"} cardholders.`
    : "Quote skeleton — door count not entered yet.";

  return {
    kind: "ACCESS_CONTROL_SCOPING",
    summary,
    findings,
    risks,
    recommendedActions,
    recommendedLineItems,
    coveragePct,
  };
}
