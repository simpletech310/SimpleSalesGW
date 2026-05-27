import { PipelineStage } from "@prisma/client";

/**
 * Canonical 10-stage pipeline order, used by both server components
 * (PipelineStrip, /pipeline page) and the client kanban (PipelineBoard).
 *
 * Lives in lib/pipeline (server-safe — no "use client" boundary) so server
 * components can import the array as a plain value. Re-exported from
 * PipelineBoard for backward-compat.
 */
export const ALL_STAGES: PipelineStage[] = [
  PipelineStage.LEAD,
  PipelineStage.QUALIFIED,
  PipelineStage.FIRST_INTERACTION,
  PipelineStage.SITE_SURVEY_SCHEDULED,
  PipelineStage.DISCOVERY,
  PipelineStage.QUOTE_IN_PROGRESS,
  PipelineStage.QUOTE_SENT,
  PipelineStage.NEGOTIATION,
  PipelineStage.CLOSED_WON,
  PipelineStage.CLOSED_LOST,
];

/**
 * Indices 0..7 are the "active" linear progression; 8 + 9 are terminals
 * reached via explicit close controls on the lead detail page.
 */
export const LAST_ACTIVE_STAGE_INDEX = 7;
