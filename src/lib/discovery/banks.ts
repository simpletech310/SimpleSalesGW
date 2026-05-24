import type { DiscoveryKind } from "@prisma/client";
import type { DiscoveryBank } from "./types";
import { SITE_SURVEY_BANK } from "./site-survey-questions";
import { AI_READINESS_BANK } from "./ai-readiness-questions";
import { NIST_CSF_BANK } from "./nist-csf-questions";
import { NIST_800_171_BANK } from "./nist-800-171-questions";
import { VOICE_SCOPING_BANK } from "./voice-scoping-questions";
import { CCTV_SCOPING_BANK } from "./cctv-scoping-questions";
import { ACCESS_CONTROL_SCOPING_BANK } from "./access-control-scoping-questions";

const BANKS: Record<DiscoveryKind, DiscoveryBank> = {
  SITE_SURVEY: SITE_SURVEY_BANK,
  AI_READINESS: AI_READINESS_BANK,
  NIST_CSF: NIST_CSF_BANK,
  NIST_800_171: NIST_800_171_BANK,
  // v2.17 — pre-sale scoping banks
  VOICE_SCOPING: VOICE_SCOPING_BANK,
  CCTV_SCOPING: CCTV_SCOPING_BANK,
  ACCESS_CONTROL_SCOPING: ACCESS_CONTROL_SCOPING_BANK,
};

export function bankForKind(kind: DiscoveryKind): DiscoveryBank {
  return BANKS[kind];
}

export function discoveryTitle(kind: DiscoveryKind): string {
  switch (kind) {
    case "SITE_SURVEY": return "MSP Site Survey";
    case "AI_READINESS": return "AI Readiness Questionnaire";
    case "NIST_CSF": return "NIST CSF 2.0 Self-Assessment";
    case "NIST_800_171": return "NIST 800-171 / CMMC Readiness";
    case "VOICE_SCOPING": return "Voice / Phone Pre-Sale Scoping";
    case "CCTV_SCOPING": return "CCTV / Video Pre-Sale Scoping";
    case "ACCESS_CONTROL_SCOPING": return "Access Control Pre-Sale Scoping";
  }
}

/**
 * v2.17 — which kinds are pre-sale scoping (run on a Lead) vs.
 * full post-handoff discovery (run on a Customer).
 */
export function isPreSaleKind(kind: DiscoveryKind): boolean {
  return (
    kind === "VOICE_SCOPING" ||
    kind === "CCTV_SCOPING" ||
    kind === "ACCESS_CONTROL_SCOPING"
  );
}
