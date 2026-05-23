/**
 * Shared types for the three discovery question banks.
 * Loosely mirrors the sales-portal Question type but adds `weight` for
 * tiered scoring (NIST CSF) and `section` for sectioned scorecards.
 */

export type DiscoveryQuestionType =
  | "single_select"
  | "multi_select"
  | "boolean"
  | "boolean_with_text"
  | "numeric"
  | "date"
  | "text";

export type DiscoveryQuestionOption = {
  value: string;
  label: string;
  /** Optional tier (1-4) or score (0-4) contribution; meaning is kind-specific. */
  weight?: number;
};

export type DiscoveryQuestion = {
  id: string;
  section: string;
  prompt: string;
  helpText?: string;
  type: DiscoveryQuestionType;
  required: boolean;
  options?: ReadonlyArray<DiscoveryQuestionOption>;
};

export type DiscoveryBank = {
  kind: "SITE_SURVEY" | "AI_READINESS" | "NIST_CSF";
  questions: ReadonlyArray<DiscoveryQuestion>;
};
