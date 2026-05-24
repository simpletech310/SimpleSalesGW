-- v2.23 — vCIO/Sales Engineer elevation
-- AI plan acceptance → onboarding-task seeding, polymorphic attachments
-- for inventory + assessment context, enum extensions.

-- Extend ResearchArtifactType + AiFeatureKind (separate transaction
-- per Postgres rule: new enum values can't be USED in the same tx
-- they're added in — but here we only declare them, don't reference
-- as defaults).
ALTER TYPE "ResearchArtifactType" ADD VALUE 'VCIO_RECOMMENDATION';
ALTER TYPE "AiFeatureKind" ADD VALUE 'VCIO_RECOMMENDATION';

-- Attachment: leadId becomes nullable + polymorphic owner columns added.
-- Existing rows keep their leadId (NOT NULL → NULL is permissive).
ALTER TABLE "attachments"
  ALTER COLUMN "lead_id" DROP NOT NULL,
  ADD COLUMN "entity_type" TEXT,
  ADD COLUMN "entity_id"   UUID;

CREATE INDEX "attachments_entity_type_entity_id_idx"
  ON "attachments"("entity_type", "entity_id");

-- DiscoveryAssessment: AI plan snapshot + acceptance audit columns.
ALTER TABLE "discovery_assessments"
  ADD COLUMN "ai_plan_snapshot"          JSONB,
  ADD COLUMN "ai_plan_generated_at"      TIMESTAMP(3),
  ADD COLUMN "plan_accepted_at"          TIMESTAMP(3),
  ADD COLUMN "plan_accepted_by_user_id"  UUID,
  ADD COLUMN "plan_accepted_snapshot"    JSONB;

ALTER TABLE "discovery_assessments"
  ADD CONSTRAINT "discovery_assessments_plan_accepted_by_user_id_fkey"
  FOREIGN KEY ("plan_accepted_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
