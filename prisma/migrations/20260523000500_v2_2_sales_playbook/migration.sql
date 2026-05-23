-- v2.2 — Sales Playbook digitization: qualification scorecard, discovery call notes,
-- objections library + log, outreach templates library.

-- New enums
CREATE TYPE "QualificationVerdict" AS ENUM ('LIGHTHOUSE', 'STRONG_FIT', 'MARGINAL', 'REFER', 'DECLINE');
CREATE TYPE "OutreachCategory" AS ENUM ('INTRO', 'FOLLOW_UP', 'POST_ASSESSMENT', 'PROPOSAL', 'NURTURE');

-- Qualification Scorecard (1:1 with Lead)
CREATE TABLE "qualification_scorecards" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "industry_fit" INTEGER NOT NULL DEFAULT 0,
    "size_fit" INTEGER NOT NULL DEFAULT 0,
    "geography" INTEGER NOT NULL DEFAULT 0,
    "growth_posture" INTEGER NOT NULL DEFAULT 0,
    "authority" INTEGER NOT NULL DEFAULT 0,
    "budget" INTEGER NOT NULL DEFAULT 0,
    "timeline" INTEGER NOT NULL DEFAULT 0,
    "compliance_driver" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "verdict" "QualificationVerdict",
    "reason_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "scored_by_user_id" UUID,
    "scored_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "qualification_scorecards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "qualification_scorecards_lead_id_key" ON "qualification_scorecards"("lead_id");
CREATE INDEX "qualification_scorecards_verdict_idx" ON "qualification_scorecards"("verdict");
ALTER TABLE "qualification_scorecards" ADD CONSTRAINT "qualification_scorecards_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "qualification_scorecards" ADD CONSTRAINT "qualification_scorecards_scored_by_user_id_fkey"
    FOREIGN KEY ("scored_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Discovery Call Notes
CREATE TABLE "discovery_call_notes" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "conducted_at" TIMESTAMP(3) NOT NULL,
    "conducted_by_user_id" UUID NOT NULL,
    "duration_minutes" INTEGER,
    "opening_notes" TEXT,
    "business_notes" TEXT,
    "tech_notes" TEXT,
    "decision_notes" TEXT,
    "mini_pitch_notes" TEXT,
    "close_notes" TEXT,
    "next_step" TEXT,
    "next_step_due_at" TIMESTAMP(3),
    "commitments" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "red_flags" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "pre_call_checklist" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "discovery_call_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "discovery_call_notes_lead_id_conducted_at_idx" ON "discovery_call_notes"("lead_id", "conducted_at");
ALTER TABLE "discovery_call_notes" ADD CONSTRAINT "discovery_call_notes_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "discovery_call_notes" ADD CONSTRAINT "discovery_call_notes_conducted_by_user_id_fkey"
    FOREIGN KEY ("conducted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Objection Templates (library)
CREATE TABLE "objection_templates" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "industry" "Industry",
    "trigger" TEXT NOT NULL,
    "rebuttal" TEXT NOT NULL,
    "source" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "objection_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "objection_templates_category_idx" ON "objection_templates"("category");
CREATE INDEX "objection_templates_industry_idx" ON "objection_templates"("industry");

-- Objection Logs (per-lead)
CREATE TABLE "objection_logs" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "template_id" UUID,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "rebuttal_used" TEXT,
    "outcome" TEXT,
    "raised_by_user_id" UUID NOT NULL,
    "raised_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "objection_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "objection_logs_lead_id_raised_at_idx" ON "objection_logs"("lead_id", "raised_at");
ALTER TABLE "objection_logs" ADD CONSTRAINT "objection_logs_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "objection_logs" ADD CONSTRAINT "objection_logs_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "objection_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "objection_logs" ADD CONSTRAINT "objection_logs_raised_by_user_id_fkey"
    FOREIGN KEY ("raised_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Outreach Templates (library — DB-backed)
CREATE TABLE "outreach_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "OutreachCategory" NOT NULL,
    "industry" "Industry",
    "trigger" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "placeholders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "outreach_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "outreach_templates_name_key" ON "outreach_templates"("name");
CREATE INDEX "outreach_templates_category_idx" ON "outreach_templates"("category");
CREATE INDEX "outreach_templates_industry_idx" ON "outreach_templates"("industry");
