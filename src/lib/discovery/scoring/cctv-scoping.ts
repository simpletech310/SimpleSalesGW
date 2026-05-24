/**
 * v2.17 — CCTV pre-sale scoping → quote-ready line items.
 */

import { LINE_ITEM_STICKERS, type LineItem } from "@/lib/pricing/deal-kinds";

export type CctvScopingScorecard = {
  kind: "CCTV_SCOPING";
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

export function scoreCctvScoping(answers: Record<string, unknown>): CctvScopingScorecard {
  const total = asNumber(answers.C04);
  const indoor = asNumber(answers.C05);
  const outdoor = asNumber(answers.C06);
  const lots = asNumber(answers.C07);
  const lp = asNumber(answers.C08);
  const buildings = Math.max(1, asNumber(answers.C11));
  const retention = asNumber(answers.C14);

  const recommendedLineItems: LineItem[] = [];

  if (total > 0) {
    // Outdoor + parking + LP cameras are pricier — bump the per-unit one-time.
    const premiumCount = outdoor + lots + lp;
    const standardCount = Math.max(0, total - premiumCount);
    if (standardCount > 0) {
      recommendedLineItems.push({
        kind: "CAMERA",
        label: "Standard indoor camera",
        qty: standardCount,
        perUnitMrr: LINE_ITEM_STICKERS.CAMERA.perUnitMrr,
        perUnitOneTime: LINE_ITEM_STICKERS.CAMERA.perUnitOneTime,
      });
    }
    if (premiumCount > 0) {
      recommendedLineItems.push({
        kind: "CAMERA",
        label: "Outdoor / long-range / LP camera (premium)",
        qty: premiumCount,
        perUnitMrr: LINE_ITEM_STICKERS.CAMERA.perUnitMrr + 4, // slight monthly premium
        perUnitOneTime: 625, // higher install per camera
      });
    }
  }

  // One NVR per building (or one shared if single-building) — sized to retention
  const nvrCount = buildings;
  if (nvrCount > 0 && total > 0) {
    // Bump NVR price if retention demand is high.
    const retentionBump = retention >= 60 ? 600 : retention >= 30 ? 250 : 0;
    recommendedLineItems.push({
      kind: "NVR_DVR",
      label: `NVR / recording unit${retention >= 60 ? " (high-retention storage)" : ""}`,
      qty: nvrCount,
      perUnitMrr: 0,
      perUnitOneTime: LINE_ITEM_STICKERS.NVR_DVR.perUnitOneTime + retentionBump,
    });
  }

  // Labor: ~1.5 hr per camera install + 2 hr per NVR
  const labor = Math.ceil(total * 1.5) + nvrCount * 2;
  if (labor > 0) {
    recommendedLineItems.push({
      kind: "INSTALL_LABOR",
      label: LINE_ITEM_STICKERS.INSTALL_LABOR.label,
      qty: labor,
      perUnitMrr: 0,
      perUnitOneTime: LINE_ITEM_STICKERS.INSTALL_LABOR.perUnitOneTime,
    });
  }

  const findings: string[] = [];
  const risks: CctvScopingScorecard["risks"] = [];
  const recommendedActions: string[] = [];

  if (total > 0) {
    findings.push(`${total} cameras (${indoor} indoor, ${outdoor} outdoor, ${lots} lot, ${lp} license-plate).`);
  }
  if (retention > 0) findings.push(`Retention requirement: ${retention} days.`);

  if (!asBool(answers.C18)) {
    risks.push({
      severity: "high",
      description: "No PoE network available — switch upgrades or PoE injectors required.",
    });
    recommendedActions.push("Quote PoE switch upgrade alongside the camera install.");
  }

  if (!asBool(answers.C20)) {
    findings.push("No existing reusable cabling — full new cable runs to each camera.");
    recommendedActions.push("Site walk required to confirm cable pathways before quote finalization.");
  }

  if (asBool(answers.C16)) {
    findings.push("Off-site cloud backup of footage required.");
    recommendedActions.push("Add cloud-archive monthly fee per camera to the quote.");
  }

  const compliance = pickStringMulti(answers.C23);
  if (compliance.includes("audio_recording")) {
    risks.push({
      severity: "medium",
      description: "Audio recording — verify state's 1-party vs 2-party consent law before install.",
    });
  }
  if (compliance.includes("hipaa_areas")) {
    findings.push("HIPAA-restricted zones — camera placement must avoid clinical areas.");
  }

  const filled = Object.values(answers).filter((v) => v !== "" && v != null && !(Array.isArray(v) && v.length === 0)).length;
  const coveragePct = Math.round((filled / 25) * 100);

  const summary = total > 0
    ? `${total}-camera install across ${buildings} building${buildings === 1 ? "" : "s"}, ${retention}-day retention.`
    : "Quote skeleton — camera count not entered yet.";

  return {
    kind: "CCTV_SCOPING",
    summary,
    findings,
    risks,
    recommendedActions,
    recommendedLineItems,
    coveragePct,
  };
}
