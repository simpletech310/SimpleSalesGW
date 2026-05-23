import type { DiscoveryKind } from "@prisma/client";
import type { DiscoveryBank } from "./types";
import { SITE_SURVEY_BANK } from "./site-survey-questions";
import { AI_READINESS_BANK } from "./ai-readiness-questions";
import { NIST_CSF_BANK } from "./nist-csf-questions";

const BANKS: Record<DiscoveryKind, DiscoveryBank> = {
  SITE_SURVEY: SITE_SURVEY_BANK,
  AI_READINESS: AI_READINESS_BANK,
  NIST_CSF: NIST_CSF_BANK,
};

export function bankForKind(kind: DiscoveryKind): DiscoveryBank {
  return BANKS[kind];
}

export function discoveryTitle(kind: DiscoveryKind): string {
  switch (kind) {
    case "SITE_SURVEY": return "MSP Site Survey";
    case "AI_READINESS": return "AI Readiness Questionnaire";
    case "NIST_CSF": return "NIST CSF Self-Assessment";
  }
}
