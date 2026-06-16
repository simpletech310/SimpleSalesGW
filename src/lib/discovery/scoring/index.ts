import type { DiscoveryKind } from "@prisma/client";
import { scoreSiteSurvey, type SiteSurveyScorecard } from "./site-survey";
import { scoreAiReadiness, type AiReadinessScorecard } from "./ai-readiness";
import { scoreNistCsf, type NistCsfScorecard } from "./nist-csf";
import { scoreNist800171, type NistSp800171Scorecard } from "./nist-800-171";
// v2.17 — pre-sale scoping scorers (emit recommendedLineItems[])
import { scoreVoiceScoping, type VoiceScopingScorecard } from "./voice-scoping";
import { scoreCctvScoping, type CctvScopingScorecard } from "./cctv-scoping";
import { scoreAccessControlScoping, type AccessControlScopingScorecard } from "./access-control-scoping";
// v3.8 — vCIO assessment menu scorers
import { scoreQuickIt, type QuickItScorecard } from "./quick-it";
import { scoreNetwork, type NetworkScorecard } from "./network";
import { scoreWifi, type WifiScorecard } from "./wifi";
import { scoreSoc2Interview, type Soc2InterviewScorecard } from "./soc2-interview";
import { scoreAiReadinessLight, type AiReadinessLightScorecard } from "./ai-readiness-light";

export type DiscoveryScorecard =
  | SiteSurveyScorecard
  | AiReadinessScorecard
  | NistCsfScorecard
  | NistSp800171Scorecard
  | VoiceScopingScorecard
  | CctvScopingScorecard
  | AccessControlScopingScorecard
  | QuickItScorecard
  | NetworkScorecard
  | WifiScorecard
  | Soc2InterviewScorecard
  | AiReadinessLightScorecard;

export function scoreDiscovery(kind: DiscoveryKind, answers: Record<string, unknown>): DiscoveryScorecard {
  switch (kind) {
    case "SITE_SURVEY": return scoreSiteSurvey(answers);
    case "AI_READINESS": return scoreAiReadiness(answers);
    case "NIST_CSF": return scoreNistCsf(answers);
    case "NIST_800_171": return scoreNist800171(answers);
    case "VOICE_SCOPING": return scoreVoiceScoping(answers);
    case "CCTV_SCOPING": return scoreCctvScoping(answers);
    case "ACCESS_CONTROL_SCOPING": return scoreAccessControlScoping(answers);
    case "QUICK_IT": return scoreQuickIt(answers);
    case "NETWORK": return scoreNetwork(answers);
    case "WIFI": return scoreWifi(answers);
    case "SOC2_INTERVIEW": return scoreSoc2Interview(answers);
    case "AI_READINESS_LIGHT": return scoreAiReadinessLight(answers);
  }
}

export type {
  SiteSurveyScorecard,
  AiReadinessScorecard,
  NistCsfScorecard,
  NistSp800171Scorecard,
  VoiceScopingScorecard,
  CctvScopingScorecard,
  AccessControlScopingScorecard,
  QuickItScorecard,
  NetworkScorecard,
  WifiScorecard,
  Soc2InterviewScorecard,
  AiReadinessLightScorecard,
};
