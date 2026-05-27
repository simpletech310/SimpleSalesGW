-- v3.4 — Unified pipeline + structured site survey handoff
--
-- Two changes:
-- (1) PipelineStage enum cleanup
--     PRE_SALES   → QUOTE_IN_PROGRESS
--     PROPOSAL    → QUOTE_SENT
--     NURTURE     → QUALIFIED
--     Drop the three legacy values so every role sees the same 10 canonical
--     stages: LEAD, QUALIFIED, FIRST_INTERACTION, SITE_SURVEY_SCHEDULED,
--     DISCOVERY, QUOTE_IN_PROGRESS, QUOTE_SENT, NEGOTIATION, CLOSED_WON,
--     CLOSED_LOST.
--
-- (2) New site_surveys table — captures the rep's handoff to the vCIO:
--     scheduled date/time, POC + decision-maker, client type, and the
--     vCIO accept/reject decision required before DISCOVERY.

-- (1) Backfill legacy stage values onto the new canonical values.
UPDATE "leads" SET "pipeline_stage" = 'QUOTE_IN_PROGRESS' WHERE "pipeline_stage" = 'PRE_SALES';
UPDATE "leads" SET "pipeline_stage" = 'QUOTE_SENT'        WHERE "pipeline_stage" = 'PROPOSAL';
UPDATE "leads" SET "pipeline_stage" = 'QUALIFIED'         WHERE "pipeline_stage" = 'NURTURE';

-- Rebuild the enum without the legacy values. Postgres can't DROP individual
-- enum values, so we rename the old type, create the new one, and migrate.
ALTER TYPE "PipelineStage" RENAME TO "PipelineStage_old";

CREATE TYPE "PipelineStage" AS ENUM (
  'LEAD',
  'QUALIFIED',
  'FIRST_INTERACTION',
  'SITE_SURVEY_SCHEDULED',
  'DISCOVERY',
  'QUOTE_IN_PROGRESS',
  'QUOTE_SENT',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST'
);

ALTER TABLE "leads"
  ALTER COLUMN "pipeline_stage" DROP DEFAULT,
  ALTER COLUMN "pipeline_stage" TYPE "PipelineStage" USING "pipeline_stage"::text::"PipelineStage",
  ALTER COLUMN "pipeline_stage" SET DEFAULT 'LEAD';

-- deal_debriefs.outcome also uses PipelineStage (restricted in app code to
-- CLOSED_WON / CLOSED_LOST, so no backfill needed) — recast onto the new type
-- before dropping the legacy enum.
ALTER TABLE "deal_debriefs"
  ALTER COLUMN "outcome" TYPE "PipelineStage" USING "outcome"::text::"PipelineStage";

DROP TYPE "PipelineStage_old";

-- (2) SiteSurvey enums + table
CREATE TYPE "SiteSurveyClientType" AS ENUM ('IT', 'ACCESS_CONTROL', 'CCTV', 'MIXED');
CREATE TYPE "SiteSurveyStatus"     AS ENUM ('DRAFT', 'AWAITING_VCIO_ACCEPT', 'ACCEPTED', 'REJECTED', 'COMPLETED');

CREATE TABLE "site_surveys" (
  "id"                    UUID                    NOT NULL DEFAULT gen_random_uuid(),
  "lead_id"               UUID                    NOT NULL,
  "scheduled_date"        TIMESTAMP(3)            NOT NULL,
  "scheduled_start"       TEXT                    NOT NULL,
  "scheduled_end"         TEXT                    NOT NULL,
  "timezone"              TEXT                    NOT NULL DEFAULT 'America/New_York',
  "poc_name"              TEXT                    NOT NULL,
  "poc_title"             TEXT                    NOT NULL,
  "poc_email"             TEXT                    NOT NULL,
  "poc_phone"             TEXT                    NOT NULL,
  "poc_can_authorize"     BOOLEAN                 NOT NULL DEFAULT false,
  "client_type"           "SiteSurveyClientType"  NOT NULL,
  "status"                "SiteSurveyStatus"      NOT NULL DEFAULT 'AWAITING_VCIO_ACCEPT',
  "notes_for_vcio"        TEXT,
  "vcio_user_id"          UUID,
  "vcio_accepted_at"      TIMESTAMP(3),
  "vcio_rejected_at"      TIMESTAMP(3),
  "vcio_reject_reason"    TEXT,
  "completed_at"          TIMESTAMP(3),
  "discovery_verified_at" TIMESTAMP(3),
  "verified_seat_count"   INTEGER,
  "verified_site_count"   INTEGER,
  "created_by_id"         UUID                    NOT NULL,
  "created_at"            TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3)            NOT NULL,
  CONSTRAINT "site_surveys_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "site_surveys_lead_id_key" UNIQUE     ("lead_id")
);

CREATE INDEX "site_surveys_status_idx"          ON "site_surveys"("status");
CREATE INDEX "site_surveys_vcio_user_id_idx"    ON "site_surveys"("vcio_user_id");
CREATE INDEX "site_surveys_scheduled_date_idx"  ON "site_surveys"("scheduled_date");

ALTER TABLE "site_surveys"
  ADD CONSTRAINT "site_surveys_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_surveys"
  ADD CONSTRAINT "site_surveys_vcio_user_id_fkey"
    FOREIGN KEY ("vcio_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "site_surveys"
  ADD CONSTRAINT "site_surveys_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
