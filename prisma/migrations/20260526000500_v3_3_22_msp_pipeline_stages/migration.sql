-- v3.3.22 — Add MSP-friendly pipeline stages.
--
-- New canonical flow:
--   LEAD → QUALIFIED → FIRST_INTERACTION → SITE_SURVEY_SCHEDULED →
--   DISCOVERY (relabel "Discovery / Engineering") → QUOTE_IN_PROGRESS →
--   QUOTE_SENT → NEGOTIATION → CLOSED_WON / CLOSED_LOST.
--
-- PRE_SALES + PROPOSAL stay in the enum as legacy values so existing
-- leads keep working. UI surfaces them as compatibility entries.

ALTER TYPE "PipelineStage" ADD VALUE IF NOT EXISTS 'FIRST_INTERACTION';
ALTER TYPE "PipelineStage" ADD VALUE IF NOT EXISTS 'SITE_SURVEY_SCHEDULED';
ALTER TYPE "PipelineStage" ADD VALUE IF NOT EXISTS 'QUOTE_IN_PROGRESS';
ALTER TYPE "PipelineStage" ADD VALUE IF NOT EXISTS 'QUOTE_SENT';
