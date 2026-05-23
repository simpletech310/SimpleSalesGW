-- v2.0 — post-handoff customer lifecycle: customers, discovery assessments,
-- onboarding tasks, QBRs.

CREATE TYPE "CustomerStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'PAUSED', 'CHURNED');
CREATE TYPE "DiscoveryKind" AS ENUM ('SITE_SURVEY', 'AI_READINESS', 'NIST_CSF');
CREATE TYPE "DiscoveryStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "OnboardingPhase" AS ENUM ('PRE_ENGAGEMENT', 'DISCOVERY', 'ONBOARD', 'STABILIZE', 'STEADY_STATE');
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED', 'BLOCKED');

-- Customers (post-close)
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "account_manager_id" UUID,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ONBOARDING',
    "current_phase" "OnboardingPhase" NOT NULL DEFAULT 'PRE_ENGAGEMENT',
    "onboarding_started_at" TIMESTAMP(3),
    "onboarding_completed_at" TIMESTAMP(3),
    "qbr_frequency_days" INTEGER NOT NULL DEFAULT 90,
    "next_qbr_at" TIMESTAMP(3),
    "strategic_roadmap" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customers_lead_id_key" ON "customers"("lead_id");
CREATE INDEX "customers_status_idx" ON "customers"("status");
CREATE INDEX "customers_account_manager_id_idx" ON "customers"("account_manager_id");
ALTER TABLE "customers"
    ADD CONSTRAINT "customers_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customers"
    ADD CONSTRAINT "customers_account_manager_id_fkey"
    FOREIGN KEY ("account_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Discovery assessments (Site Survey, AI Readiness, NIST CSF)
CREATE TABLE "discovery_assessments" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "kind" "DiscoveryKind" NOT NULL,
    "status" "DiscoveryStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "scorecard" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_assessments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "discovery_assessments_customer_id_kind_idx" ON "discovery_assessments"("customer_id", "kind");
ALTER TABLE "discovery_assessments"
    ADD CONSTRAINT "discovery_assessments_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "discovery_assessments"
    ADD CONSTRAINT "discovery_assessments_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Onboarding tasks
CREATE TABLE "onboarding_tasks" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "phase" "OnboardingPhase" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner_user_id" UUID,
    "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "position" INTEGER NOT NULL,
    "template_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "onboarding_tasks_customer_id_phase_position_idx" ON "onboarding_tasks"("customer_id", "phase", "position");
CREATE INDEX "onboarding_tasks_owner_user_id_status_idx" ON "onboarding_tasks"("owner_user_id", "status");
ALTER TABLE "onboarding_tasks"
    ADD CONSTRAINT "onboarding_tasks_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "onboarding_tasks"
    ADD CONSTRAINT "onboarding_tasks_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- QBRs
CREATE TABLE "qbrs" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "attendees" JSONB NOT NULL DEFAULT '[]',
    "agenda" JSONB NOT NULL DEFAULT '[]',
    "outcomes" TEXT,
    "follow_ups" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qbrs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "qbrs_customer_id_scheduled_at_idx" ON "qbrs"("customer_id", "scheduled_at");
ALTER TABLE "qbrs"
    ADD CONSTRAINT "qbrs_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
