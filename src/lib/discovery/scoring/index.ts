import type { DiscoveryKind } from "@prisma/client";
import { scoreSiteSurvey, type SiteSurveyScorecard } from "./site-survey";
import { scoreAiReadiness, type AiReadinessScorecard } from "./ai-readiness";
import { scoreNistCsf, type NistCsfScorecard } from "./nist-csf";

export type DiscoveryScorecard = SiteSurveyScorecard | AiReadinessScorecard | NistCsfScorecard;

export function scoreDiscovery(kind: DiscoveryKind, answers: Record<string, unknown>): DiscoveryScorecard {
  switch (kind) {
    case "SITE_SURVEY": return scoreSiteSurvey(answers);
    case "AI_READINESS": return scoreAiReadiness(answers);
    case "NIST_CSF": return scoreNistCsf(answers);
  }
}

export type { SiteSurveyScorecard, AiReadinessScorecard, NistCsfScorecard };
