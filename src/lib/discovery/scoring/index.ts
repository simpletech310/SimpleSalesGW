import type { DiscoveryKind } from "@prisma/client";
import { scoreSiteSurvey, type SiteSurveyScorecard } from "./site-survey";
import { scoreAiReadiness, type AiReadinessScorecard } from "./ai-readiness";
import { scoreNistCsf, type NistCsfScorecard } from "./nist-csf";
import { scoreNist800171, type NistSp800171Scorecard } from "./nist-800-171";

export type DiscoveryScorecard =
  | SiteSurveyScorecard
  | AiReadinessScorecard
  | NistCsfScorecard
  | NistSp800171Scorecard;

export function scoreDiscovery(kind: DiscoveryKind, answers: Record<string, unknown>): DiscoveryScorecard {
  switch (kind) {
    case "SITE_SURVEY": return scoreSiteSurvey(answers);
    case "AI_READINESS": return scoreAiReadiness(answers);
    case "NIST_CSF": return scoreNistCsf(answers);
    case "NIST_800_171": return scoreNist800171(answers);
  }
}

export type { SiteSurveyScorecard, AiReadinessScorecard, NistCsfScorecard, NistSp800171Scorecard };
