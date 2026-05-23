-- v2.3 — Process unification: structured Handoff + OnboardingTask.ownerRole.

-- Handoff restructure: drop freeform payload, add 60-field structured columns.
ALTER TABLE "handoffs" DROP COLUMN "payload";

ALTER TABLE "handoffs"
    ADD COLUMN "deal_value"             DECIMAL(12, 2),
    ADD COLUMN "bundle_id"              "ServiceBundle",
    ADD COLUMN "compliance_overlay"     TEXT[]  DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "contracts_signed"       TEXT[]  DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "decision_makers"        JSONB   NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN "hard_commitments"       JSONB   NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN "soft_commitments"       JSONB   NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN "objections_and_skeptics" JSONB  NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN "stakeholder_context"    TEXT,
    ADD COLUMN "budget_snapshot"        JSONB,
    ADD COLUMN "success_criteria"       JSONB   NOT NULL DEFAULT '[]'::jsonb;

-- OnboardingTask.ownerRole + index
ALTER TABLE "onboarding_tasks" ADD COLUMN "owner_role" "Role";
CREATE INDEX "onboarding_tasks_owner_role_status_idx" ON "onboarding_tasks"("owner_role", "status");
