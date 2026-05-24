-- v2.20 — AI features pass: usage tracking + handoff QC + new artifact types

-- Extend ResearchArtifactType for the new cached AI outputs.
ALTER TYPE "ResearchArtifactType" ADD VALUE 'OBJECTION_REBUTTAL';
ALTER TYPE "ResearchArtifactType" ADD VALUE 'DISCOVERY_PREP_BRIEF';
ALTER TYPE "ResearchArtifactType" ADD VALUE 'OUTREACH_DRAFT';
ALTER TYPE "ResearchArtifactType" ADD VALUE 'PRESALE_NARRATIVE';
ALTER TYPE "ResearchArtifactType" ADD VALUE 'HANDOFF_QC';

-- New enum: which AI feature spent a Claude call.
CREATE TYPE "AiFeatureKind" AS ENUM (
  'RESEARCH_SUMMARY',
  'OBJECTION_REBUTTAL',
  'DISCOVERY_PREP',
  'OUTREACH_PERSONALIZE',
  'PRESALE_NARRATIVE',
  'HANDOFF_QC'
);

-- Handoff gains a cached QC result column.
ALTER TABLE "handoffs"
  ADD COLUMN "qc_result" JSONB;

-- Usage log — every Claude call writes one row.
CREATE TABLE "ai_usage_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lead_id" UUID,
  "user_id" UUID,
  "feature" "AiFeatureKind" NOT NULL,
  "model" TEXT NOT NULL,
  "input_tokens" INTEGER NOT NULL,
  "output_tokens" INTEGER NOT NULL,
  "cache_read_input_tokens" INTEGER,
  "cache_creation_input_tokens" INTEGER,
  "estimated_cost_usd" DECIMAL(10, 6) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_usage_logs_lead_id_created_at_idx"
  ON "ai_usage_logs" ("lead_id", "created_at");
CREATE INDEX "ai_usage_logs_feature_created_at_idx"
  ON "ai_usage_logs" ("feature", "created_at");
CREATE INDEX "ai_usage_logs_created_at_idx"
  ON "ai_usage_logs" ("created_at");

ALTER TABLE "ai_usage_logs"
  ADD CONSTRAINT "ai_usage_logs_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_usage_logs"
  ADD CONSTRAINT "ai_usage_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
