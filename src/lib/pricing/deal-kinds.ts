import { DealKind, ServiceLine } from "@prisma/client";

/**
 * v2.15 — Deal-kind metadata.
 *
 * Each DealKind has:
 *   - human label + tagline for pickers
 *   - which ServiceLines are typically included
 *   - which line-item KIND keys the PricingCard quote builder should show
 *   - which onboarding template subset to materialize at handoff acceptance
 *
 * This is the central registry — PricingCard, NewLeadForm, Customer
 * creation, and the handoff form all import from here so they stay in
 * sync.
 */

export type DealKindMeta = {
  kind: DealKind;
  label: string;
  tagline: string;
  /** Service lines a deal of this kind typically includes. */
  serviceLines: ReadonlyArray<ServiceLine>;
  /** Line-item KIND keys the PricingCard builder should expose. */
  lineItemKinds: ReadonlyArray<LineItemKind>;
  /** Stable selector for the onboarding template subset. */
  onboardingTemplateKey: TemplateKey;
  /** True if this kind uses the legacy seat-based bundle math. */
  usesBundles: boolean;
};

/** Discrete categories of priceable line items. Drives the quote builder UI. */
export type LineItemKind =
  | "VOICE_EXTENSION"     // per phone/extension/month MRR + handset one-time
  | "CABLE_DROP"          // per cable drop one-time
  | "DOOR_READER"         // per door access reader MRR + install one-time
  | "CAMERA"              // per camera MRR + install one-time
  | "NVR_DVR"             // recording unit one-time
  | "VOICE_HARDWARE"      // handset / conference phone one-time
  | "INSTALL_LABOR"       // labor hours one-time
  | "OTHER";              // free-text catch-all

/** Template-subset selector. Real definitions live in onboarding/task-templates.ts. */
export type TemplateKey =
  | "FULL_MANAGED_IT"
  | "VOICE_ONLY"
  | "VOICE_PLUS_VIDEO"
  | "CABLING_JOB"
  | "ACCESS_CONTROL"
  | "VIDEO_SURVEILLANCE"
  | "CUSTOM_MIX";

export const DEAL_KIND_META: Record<DealKind, DealKindMeta> = {
  MANAGED_IT_BUNDLE: {
    kind: "MANAGED_IT_BUNDLE",
    label: "Managed IT bundle",
    tagline: "Full MSP engagement. Sticker-priced by seat tier + bundle.",
    serviceLines: [ServiceLine.MANAGED_IT, ServiceLine.CYBERSECURITY],
    lineItemKinds: [],
    onboardingTemplateKey: "FULL_MANAGED_IT",
    usesBundles: true,
  },
  VOICE_ONLY: {
    kind: "VOICE_ONLY",
    label: "Voice / Phone system",
    tagline: "Hosted VoIP only. Priced per extension + hardware.",
    serviceLines: [ServiceLine.VOIP],
    lineItemKinds: ["VOICE_EXTENSION", "VOICE_HARDWARE", "INSTALL_LABOR"],
    onboardingTemplateKey: "VOICE_ONLY",
    usesBundles: false,
  },
  VOICE_PLUS_VIDEO: {
    kind: "VOICE_PLUS_VIDEO",
    label: "Voice + Security Cameras",
    tagline: "Hosted VoIP plus video surveillance. Common Burbank SMB combo.",
    serviceLines: [ServiceLine.VOIP, ServiceLine.VIDEO],
    lineItemKinds: ["VOICE_EXTENSION", "VOICE_HARDWARE", "CAMERA", "NVR_DVR", "INSTALL_LABOR"],
    onboardingTemplateKey: "VOICE_PLUS_VIDEO",
    usesBundles: false,
  },
  STRUCTURED_CABLING_JOB: {
    kind: "STRUCTURED_CABLING_JOB",
    label: "Structured cabling project",
    tagline: "One-time data + voice cabling install. No MRR.",
    serviceLines: [ServiceLine.CABLING],
    lineItemKinds: ["CABLE_DROP", "INSTALL_LABOR", "OTHER"],
    onboardingTemplateKey: "CABLING_JOB",
    usesBundles: false,
  },
  ACCESS_CONTROL_PROJECT: {
    kind: "ACCESS_CONTROL_PROJECT",
    label: "Access control project",
    tagline: "Card / fob readers, door hardware, software licensing.",
    serviceLines: [ServiceLine.ACCESS_CONTROL],
    lineItemKinds: ["DOOR_READER", "INSTALL_LABOR", "OTHER"],
    onboardingTemplateKey: "ACCESS_CONTROL",
    usesBundles: false,
  },
  VIDEO_SURVEILLANCE_PROJECT: {
    kind: "VIDEO_SURVEILLANCE_PROJECT",
    label: "Video surveillance project",
    tagline: "Camera install + NVR/DVR + remote viewing. Standalone (no voice).",
    serviceLines: [ServiceLine.VIDEO],
    lineItemKinds: ["CAMERA", "NVR_DVR", "INSTALL_LABOR", "OTHER"],
    onboardingTemplateKey: "VIDEO_SURVEILLANCE",
    usesBundles: false,
  },
  CUSTOM_MIX: {
    kind: "CUSTOM_MIX",
    label: "Custom / mixed scope",
    tagline: "Anything else — voice + cabling + cameras + access in one deal, etc.",
    serviceLines: [
      ServiceLine.MANAGED_IT, ServiceLine.VOIP, ServiceLine.CABLING,
      ServiceLine.ACCESS_CONTROL, ServiceLine.VIDEO,
    ],
    lineItemKinds: ["VOICE_EXTENSION", "VOICE_HARDWARE", "CABLE_DROP", "DOOR_READER", "CAMERA", "NVR_DVR", "INSTALL_LABOR", "OTHER"],
    onboardingTemplateKey: "CUSTOM_MIX",
    usesBundles: false,
  },
};

export function listDealKinds(): ReadonlyArray<DealKindMeta> {
  return [
    DEAL_KIND_META.MANAGED_IT_BUNDLE,
    DEAL_KIND_META.VOICE_ONLY,
    DEAL_KIND_META.VOICE_PLUS_VIDEO,
    DEAL_KIND_META.STRUCTURED_CABLING_JOB,
    DEAL_KIND_META.ACCESS_CONTROL_PROJECT,
    DEAL_KIND_META.VIDEO_SURVEILLANCE_PROJECT,
    DEAL_KIND_META.CUSTOM_MIX,
  ];
}

// ---------------------------------------------------------------------------
// Line items + sticker math
// ---------------------------------------------------------------------------

export type LineItem = {
  kind: LineItemKind;
  label: string;
  qty: number;
  perUnitMrr: number;    // monthly recurring per unit
  perUnitOneTime: number; // one-time per unit
  notes?: string;
};

/** Stickers per LineItemKind. Editable later via /admin/pricing if we expose them. */
export const LINE_ITEM_STICKERS: Record<LineItemKind, { label: string; perUnitMrr: number; perUnitOneTime: number; helpText: string }> = {
  VOICE_EXTENSION: {
    label: "Voice extension (seat)",
    perUnitMrr: 32,
    perUnitOneTime: 25,
    helpText: "One DID + hosted PBX seat per extension. Includes voicemail, call routing, mobile twinning.",
  },
  VOICE_HARDWARE: {
    label: "Phone handset (Yealink / Polycom)",
    perUnitMrr: 0,
    perUnitOneTime: 185,
    helpText: "Mid-range PoE deskphone. Conference phones priced separately.",
  },
  CABLE_DROP: {
    label: "Cabling drop (Cat6 / Cat6a, terminated)",
    perUnitMrr: 0,
    perUnitOneTime: 175,
    helpText: "Per drop: cable + terminations + plate + test + cert.",
  },
  DOOR_READER: {
    // v3.3.4 — access control sold as project work only, no MRR per
    // Gateway policy. Software licensing folds into bundle MRR when sold
    // inside Professional/Enterprise.
    label: "Access control door (reader + software)",
    perUnitMrr: 0,
    perUnitOneTime: 950,
    helpText: "Per door: reader + REX + strike + cloud software licensing. One-time install — no recurring fee on standalone deals.",
  },
  CAMERA: {
    // v3.3.4 — video surveillance is project work, not recurring.
    label: "Surveillance camera",
    perUnitMrr: 0,
    perUnitOneTime: 425,
    helpText: "Per camera: IP camera (4MP+) + mount + PoE drop + recording. NVR priced separately. No MRR on standalone deals.",
  },
  NVR_DVR: {
    label: "NVR / DVR recording unit",
    perUnitMrr: 0,
    perUnitOneTime: 1850,
    helpText: "Recording appliance + storage. One per site typically; sized for camera count.",
  },
  INSTALL_LABOR: {
    label: "Install / configuration labor (hr)",
    perUnitMrr: 0,
    perUnitOneTime: 145,
    helpText: "Technician time on site or remote. Used for unscoped install work.",
  },
  OTHER: {
    label: "Other (free text)",
    perUnitMrr: 0,
    perUnitOneTime: 0,
    helpText: "Catch-all for unique scope items not on the standard sheet.",
  },
};

/** Make a sticker-priced line at the given quantity. Used by PricingCard to add defaults. */
export function stickerLine(kind: LineItemKind, qty: number = 1): LineItem {
  const s = LINE_ITEM_STICKERS[kind];
  return {
    kind,
    label: s.label,
    qty: Math.max(1, Math.floor(qty)),
    perUnitMrr: s.perUnitMrr,
    perUnitOneTime: s.perUnitOneTime,
  };
}

export type LineTotals = { monthlyMrr: number; oneTime: number };

export function totalsFor(lines: ReadonlyArray<LineItem>): LineTotals {
  return lines.reduce<LineTotals>(
    (acc, l) => ({
      monthlyMrr: acc.monthlyMrr + l.qty * l.perUnitMrr,
      oneTime: acc.oneTime + l.qty * l.perUnitOneTime,
    }),
    { monthlyMrr: 0, oneTime: 0 },
  );
}
