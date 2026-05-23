-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SALESPERSON', 'SALES_MANAGER', 'VCIO', 'COO', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "Industry" AS ENUM ('MEDICAL', 'LEGAL', 'FEDERAL_CONTRACTING', 'MANUFACTURING', 'HOSPITALITY', 'FINANCIAL_SERVICES', 'PROFESSIONAL_SERVICES', 'EDUCATION', 'NONPROFIT', 'OTHER');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('LEAD', 'QUALIFIED', 'DISCOVERY', 'PRE_SALES', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST', 'NURTURE');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('INBOUND', 'OUTBOUND', 'REFERRAL', 'EVENT', 'PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplianceDriver" AS ENUM ('HIPAA', 'PCI', 'CMMC', 'FERPA', 'GLBA', 'NYDFS', 'SEC', 'FFIEC', 'OTHER', 'NONE');

-- CreateEnum
CREATE TYPE "RegulatedDataType" AS ENUM ('PHI', 'PII', 'PCI_DATA', 'CUI', 'FERPA_DATA', 'FINANCIAL', 'TRADE_SECRET', 'OTHER', 'NONE');

-- CreateEnum
CREATE TYPE "MspSatisfaction" AS ENUM ('HAPPY', 'NEUTRAL', 'LEAVING', 'NONE');

-- CreateEnum
CREATE TYPE "ServiceLine" AS ENUM ('MANAGED_IT', 'VOIP', 'CABLING', 'ACCESS_CONTROL', 'VIDEO', 'CYBERSECURITY', 'NIST_ASSESSMENT', 'AI_ADVISORY', 'VCIO_RETAINER');

-- CreateEnum
CREATE TYPE "ServiceBundle" AS ENUM ('ESSENTIAL', 'PROFESSIONAL', 'ENTERPRISE', 'COMPLIANCE_PLUS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'NOTE', 'STAGE_CHANGE', 'SCORE_CHANGE', 'RESEARCH', 'ASSESSMENT_SENT', 'ASSESSMENT_COMPLETED', 'PROPOSAL_SENT', 'FOLLOW_UP_SCHEDULED', 'HANDOFF_INITIATED', 'HANDOFF_ACCEPTED');

-- CreateEnum
CREATE TYPE "ActivityOutcome" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NO_RESPONSE');

-- CreateEnum
CREATE TYPE "AssessmentMode" AS ENUM ('IN_PERSON', 'SELF_SERVICE_LINK', 'HYBRID');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ResearchArtifactType" AS ENUM ('WEBSITE_SNAPSHOT', 'LINKEDIN_LINK', 'GOOGLE_BUSINESS_DATA', 'NEWS_MENTION', 'CLAUDE_SUMMARY');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'EXPORT');

-- CreateEnum
CREATE TYPE "HandoffStatus" AS ENUM ('DRAFT', 'INITIATED', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SALESPERSON',
    "phone" TEXT,
    "avatar_url" TEXT,
    "password_hash" TEXT,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "business_name" TEXT NOT NULL,
    "dba_name" TEXT,
    "industry" "Industry" NOT NULL,
    "subindustry" TEXT,
    "seat_count" INTEGER,
    "site_count" INTEGER NOT NULL DEFAULT 1,
    "address_street" TEXT,
    "address_city" TEXT,
    "address_state" TEXT,
    "address_zip" TEXT,
    "website_url" TEXT,
    "linkedin_company_url" TEXT,
    "google_business_url" TEXT,
    "primary_contact_name" TEXT,
    "primary_contact_title" TEXT,
    "primary_contact_email" TEXT,
    "primary_contact_phone" TEXT,
    "executive_sponsor_name" TEXT,
    "executive_sponsor_title" TEXT,
    "pipeline_stage" "PipelineStage" NOT NULL DEFAULT 'LEAD',
    "source" "LeadSource" NOT NULL DEFAULT 'INBOUND',
    "cyber_insurance_renewal_date" TIMESTAMP(3),
    "compliance_drivers" "ComplianceDriver"[],
    "regulated_data_types" "RegulatedDataType"[],
    "current_msp_name" TEXT,
    "current_msp_satisfaction" "MspSatisfaction" NOT NULL DEFAULT 'NONE',
    "research_summary" TEXT,
    "research_completed_at" TIMESTAMP(3),
    "suggested_bundle" "ServiceBundle",
    "services_score" INTEGER NOT NULL DEFAULT 0,
    "customer_score" INTEGER NOT NULL DEFAULT 0,
    "deal_quality_score" INTEGER NOT NULL DEFAULT 0,
    "non_strategic_flag" BOOLEAN NOT NULL DEFAULT false,
    "non_strategic_approval_user_id" UUID,
    "non_strategic_approval_reason" TEXT,
    "expected_close_date" TIMESTAMP(3),
    "actual_close_date" TIMESTAMP(3),
    "closed_lost_reason" TEXT,
    "connectwise_opportunity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "outcome" "ActivityOutcome",
    "next_action" TEXT,
    "next_action_due_at" TIMESTAMP(3),
    "next_action_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "mode" "AssessmentMode" NOT NULL DEFAULT 'IN_PERSON',
    "magic_link_token" TEXT,
    "magic_link_expires_at" TIMESTAMP(3),
    "status" "AssessmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "respondent_name" TEXT,
    "respondent_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_answers" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_value" JSONB NOT NULL,

    CONSTRAINT "assessment_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_matches" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "service_line" "ServiceLine" NOT NULL,
    "fit_score" INTEGER NOT NULL,
    "reasoning" TEXT NOT NULL,
    "recommended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "service_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_artifacts" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "type" "ResearchArtifactType" NOT NULL,
    "payload" JSONB NOT NULL,
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handoffs" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "initiator_user_id" UUID NOT NULL,
    "acceptor_user_id" UUID,
    "status" "HandoffStatus" NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB NOT NULL,
    "notes" TEXT,
    "initiated_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "leads_owner_user_id_idx" ON "leads"("owner_user_id");

-- CreateIndex
CREATE INDEX "leads_pipeline_stage_idx" ON "leads"("pipeline_stage");

-- CreateIndex
CREATE INDEX "leads_industry_idx" ON "leads"("industry");

-- CreateIndex
CREATE INDEX "leads_deal_quality_score_idx" ON "leads"("deal_quality_score");

-- CreateIndex
CREATE INDEX "leads_expected_close_date_idx" ON "leads"("expected_close_date");

-- CreateIndex
CREATE INDEX "activities_lead_id_idx" ON "activities"("lead_id");

-- CreateIndex
CREATE INDEX "activities_next_action_due_at_idx" ON "activities"("next_action_due_at");

-- CreateIndex
CREATE INDEX "notes_lead_id_idx" ON "notes"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_magic_link_token_key" ON "assessments"("magic_link_token");

-- CreateIndex
CREATE INDEX "assessments_lead_id_idx" ON "assessments"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_answers_assessment_id_question_id_key" ON "assessment_answers"("assessment_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_matches_lead_id_service_line_key" ON "service_matches"("lead_id", "service_line");

-- CreateIndex
CREATE INDEX "research_artifacts_lead_id_idx" ON "research_artifacts"("lead_id");

-- CreateIndex
CREATE INDEX "handoffs_lead_id_idx" ON "handoffs"("lead_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_id_entity_type_idx" ON "audit_logs"("entity_id", "entity_type");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_key_key" ON "system_config"("key");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_non_strategic_approval_user_id_fkey" FOREIGN KEY ("non_strategic_approval_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_matches" ADD CONSTRAINT "service_matches_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_artifacts" ADD CONSTRAINT "research_artifacts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_initiator_user_id_fkey" FOREIGN KEY ("initiator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_acceptor_user_id_fkey" FOREIGN KEY ("acceptor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

