-- v3.3 — SOP-alignment sweep
-- Adds: SOW templates + Proposal lifecycle + Kickoff + DealDebrief models,
--       trigger-event capture on Lead, paymentMethodOnFile, vCIO verdict on
--       DiscoveryAssessment, and 8 new AiFeatureKind enum values.

-- ---------------------------------------------------------------------------
-- 1. New enums
-- ---------------------------------------------------------------------------

CREATE TYPE "TriggerEvent" AS ENUM (
  'NONE',
  'CYBER_INSURANCE_RENEWAL',
  'PEER_BREACH',
  'FEDERAL_CONTRACT_ANNOUNCEMENT',
  'MA_ACTIVITY',
  'CUSTOMER_CYBER_QUESTIONNAIRE',
  'COMPLIANCE_AUDIT',
  'MSP_DISSATISFACTION',
  'GROWTH_HIRING',
  'OTHER'
);

CREATE TYPE "ProposalStatus" AS ENUM (
  'DRAFT',
  'VCIO_REVIEW',
  'MANAGER_REVIEW',
  'APPROVED',
  'SENT',
  'ACCEPTED',
  'DECLINED',
  'SUPERSEDED'
);

CREATE TYPE "ReviewVerdict" AS ENUM (
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED'
);

-- ---------------------------------------------------------------------------
-- 2. AiFeatureKind — 8 new values for the AI assistants
-- ---------------------------------------------------------------------------

ALTER TYPE "AiFeatureKind" ADD VALUE IF NOT EXISTS 'SOW_DRAFT';
ALTER TYPE "AiFeatureKind" ADD VALUE IF NOT EXISTS 'SOW_SCOPE_QC';
ALTER TYPE "AiFeatureKind" ADD VALUE IF NOT EXISTS 'ASSESSMENT_VERDICT_SUGGEST';
ALTER TYPE "AiFeatureKind" ADD VALUE IF NOT EXISTS 'HANDOFF_QUICK_WIN';
ALTER TYPE "AiFeatureKind" ADD VALUE IF NOT EXISTS 'HANDOFF_PAIN_RECAP';
ALTER TYPE "AiFeatureKind" ADD VALUE IF NOT EXISTS 'TRIGGER_EVENT_DETECT';
ALTER TYPE "AiFeatureKind" ADD VALUE IF NOT EXISTS 'KICKOFF_NARRATIVE';
ALTER TYPE "AiFeatureKind" ADD VALUE IF NOT EXISTS 'DEBRIEF_DRAFT';

-- ---------------------------------------------------------------------------
-- 2b. Handoff — stated pain + Day-30 quick win (SOP Step 8)
-- ---------------------------------------------------------------------------

ALTER TABLE "handoffs"
  ADD COLUMN "stated_pain"      TEXT,
  ADD COLUMN "day30_quick_win"  TEXT;

-- ---------------------------------------------------------------------------
-- 3. Lead — trigger event + payment-method flag
-- ---------------------------------------------------------------------------

ALTER TABLE "leads"
  ADD COLUMN "trigger_event"           "TriggerEvent" DEFAULT 'NONE',
  ADD COLUMN "trigger_event_note"      TEXT,
  ADD COLUMN "payment_method_on_file"  BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "leads_trigger_event_idx" ON "leads"("trigger_event");

-- ---------------------------------------------------------------------------
-- 4. DiscoveryAssessment — vCIO go/no-go gate
-- ---------------------------------------------------------------------------

ALTER TABLE "discovery_assessments"
  ADD COLUMN "vcio_verdict"        "ReviewVerdict",
  ADD COLUMN "vcio_verdict_at"     TIMESTAMP(3),
  ADD COLUMN "vcio_verdict_by_id"  UUID,
  ADD COLUMN "vcio_verdict_notes"  TEXT;

ALTER TABLE "discovery_assessments"
  ADD CONSTRAINT "discovery_assessments_vcio_verdict_by_id_fkey"
  FOREIGN KEY ("vcio_verdict_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "discovery_assessments_vcio_verdict_idx" ON "discovery_assessments"("vcio_verdict");

-- ---------------------------------------------------------------------------
-- 5. sow_templates
-- ---------------------------------------------------------------------------

CREATE TABLE "sow_templates" (
  "id"                    UUID            NOT NULL DEFAULT gen_random_uuid(),
  "name"                  TEXT            NOT NULL,
  "description"           TEXT,
  "bundle"                "ServiceBundle",
  "industry"              "Industry",
  "version"               INTEGER         NOT NULL DEFAULT 1,
  "active"                BOOLEAN         NOT NULL DEFAULT true,
  "scopeMarkdown"         TEXT            NOT NULL,
  "deliverablesMarkdown"  TEXT            NOT NULL,
  "timelineMarkdown"      TEXT            NOT NULL,
  "exclusionsMarkdown"    TEXT            NOT NULL,
  "termsMarkdown"         TEXT            NOT NULL,
  "created_at"            TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3)    NOT NULL,
  "created_by_user_id"    UUID,

  CONSTRAINT "sow_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sow_templates_bundle_active_idx"   ON "sow_templates"("bundle", "active");
CREATE INDEX "sow_templates_industry_active_idx" ON "sow_templates"("industry", "active");

ALTER TABLE "sow_templates"
  ADD CONSTRAINT "sow_templates_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. proposals
-- ---------------------------------------------------------------------------

CREATE TABLE "proposals" (
  "id"                          UUID             NOT NULL DEFAULT gen_random_uuid(),
  "lead_id"                     UUID             NOT NULL,
  "template_id"                 UUID,
  "version"                     INTEGER          NOT NULL DEFAULT 1,
  "status"                      "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
  "scopeMarkdown"               TEXT             NOT NULL,
  "deliverablesMarkdown"        TEXT             NOT NULL,
  "timelineMarkdown"            TEXT             NOT NULL,
  "exclusionsMarkdown"          TEXT             NOT NULL,
  "termsMarkdown"               TEXT             NOT NULL,
  "pricingSnapshot"             JSONB            NOT NULL DEFAULT '{}'::jsonb,
  "vcio_reviewed_at"            TIMESTAMP(3),
  "vcio_reviewed_by_id"         UUID,
  "vcio_review_verdict"         "ReviewVerdict",
  "vcio_review_notes"           TEXT,
  "manager_reviewed_at"         TIMESTAMP(3),
  "manager_reviewed_by_id"      UUID,
  "manager_review_verdict"      "ReviewVerdict",
  "manager_review_notes"        TEXT,
  "sent_at"                     TIMESTAMP(3),
  "sent_by_user_id"             UUID,
  "pdf_blob_url"                TEXT,
  "accepted_at"                 TIMESTAMP(3),
  "declined_at"                 TIMESTAMP(3),
  "declined_reason"             TEXT,
  "redline_requested_at"        TIMESTAMP(3),
  "redline_request_reason"      TEXT,
  "redline_resolved_at"         TIMESTAMP(3),
  "redline_resolution"          TEXT,
  "ai_drafted_at"               TIMESTAMP(3),
  "ai_draft_model"              TEXT,
  "ai_scope_qc_json"            JSONB,
  "ai_scope_qc_at"              TIMESTAMP(3),
  "created_at"                  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                  TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proposals_lead_id_version_idx" ON "proposals"("lead_id", "version");
CREATE INDEX "proposals_status_idx"          ON "proposals"("status");

ALTER TABLE "proposals"
  ADD CONSTRAINT "proposals_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "proposals_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "sow_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "proposals_vcio_reviewed_by_id_fkey"
    FOREIGN KEY ("vcio_reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "proposals_manager_reviewed_by_id_fkey"
    FOREIGN KEY ("manager_reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "proposals_sent_by_user_id_fkey"
    FOREIGN KEY ("sent_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 7. kickoffs (one per customer)
-- ---------------------------------------------------------------------------

CREATE TABLE "kickoffs" (
  "id"                       UUID         NOT NULL DEFAULT gen_random_uuid(),
  "customer_id"              UUID         NOT NULL,
  "scheduled_at"             TIMESTAMP(3),
  "completed_at"             TIMESTAMP(3),
  "relationship_narrative"   TEXT,
  "decision_maker_recap"     TEXT,
  "day30_commitment_recap"   TEXT,
  "sales_attended"           BOOLEAN      NOT NULL DEFAULT false,
  "vcio_attended"            BOOLEAN      NOT NULL DEFAULT false,
  "notes"                    TEXT,
  "ai_drafted_at"            TIMESTAMP(3),
  "ai_draft_json"            JSONB,
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3) NOT NULL,

  CONSTRAINT "kickoffs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kickoffs_customer_id_key" ON "kickoffs"("customer_id");

ALTER TABLE "kickoffs"
  ADD CONSTRAINT "kickoffs_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 8. deal_debriefs (one per lead)
-- ---------------------------------------------------------------------------

CREATE TABLE "deal_debriefs" (
  "id"                   UUID            NOT NULL DEFAULT gen_random_uuid(),
  "lead_id"              UUID            NOT NULL,
  "outcome"              "PipelineStage" NOT NULL,
  "primaryReason"        TEXT            NOT NULL,
  "what_worked"          TEXT,
  "objection_resolved"   TEXT,
  "template_that_won"    TEXT,
  "what_broke"           TEXT,
  "playbook_update"      TEXT,
  "ai_suggested_at"      TIMESTAMP(3),
  "ai_suggested_json"    JSONB,
  "submitted_by_id"      UUID            NOT NULL,
  "submitted_at"         TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "deal_debriefs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deal_debriefs_lead_id_key" ON "deal_debriefs"("lead_id");
CREATE INDEX        "deal_debriefs_outcome_idx" ON "deal_debriefs"("outcome");

ALTER TABLE "deal_debriefs"
  ADD CONSTRAINT "deal_debriefs_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "deal_debriefs_submitted_by_id_fkey"
    FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
