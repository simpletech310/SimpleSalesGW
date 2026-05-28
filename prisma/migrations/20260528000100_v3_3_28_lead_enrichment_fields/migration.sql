-- v3.3.28 — Lead enrichment fields (agentic OSINT research)
--
-- Two changes:
-- (1) ResearchArtifactType: nine additive enum values for the new
--     agentic research loop's tool-call artifacts + final briefing.
-- (2) Leads: sixteen optional first-class enrichment columns the agent
--     populates from free OSINT sources (NCUA, SEC, ProPublica, FDIC,
--     OpenCorporates, DNS, Tavily/Brave/DDG search, Hunter). All optional
--     so an empty research pass never blocks lead create/edit and never
--     clobbers manual data.

-- (1) Enum additions — additive only, no data migration needed.
ALTER TYPE "ResearchArtifactType" ADD VALUE IF NOT EXISTS 'WEB_SEARCH_RESULT';
ALTER TYPE "ResearchArtifactType" ADD VALUE IF NOT EXISTS 'EMAIL_DISCOVERY';
ALTER TYPE "ResearchArtifactType" ADD VALUE IF NOT EXISTS 'DNS_LOOKUP';
ALTER TYPE "ResearchArtifactType" ADD VALUE IF NOT EXISTS 'NCUA_LOOKUP';
ALTER TYPE "ResearchArtifactType" ADD VALUE IF NOT EXISTS 'SEC_LOOKUP';
ALTER TYPE "ResearchArtifactType" ADD VALUE IF NOT EXISTS 'FDIC_LOOKUP';
ALTER TYPE "ResearchArtifactType" ADD VALUE IF NOT EXISTS 'NONPROFIT_LOOKUP';
ALTER TYPE "ResearchArtifactType" ADD VALUE IF NOT EXISTS 'BUSINESS_REGISTRY_LOOKUP';
ALTER TYPE "ResearchArtifactType" ADD VALUE IF NOT EXISTS 'AGENT_BRIEFING';

-- (2) Lead enrichment columns. Every column is optional; arrays default
--     to empty.
ALTER TABLE "leads"
  ADD COLUMN "founded_year"               INTEGER,
  ADD COLUMN "estimated_annual_revenue"   TEXT,
  ADD COLUMN "employee_count_band"        TEXT,
  ADD COLUMN "registered_entity_type"     TEXT,
  ADD COLUMN "offices"                    JSONB,
  ADD COLUMN "key_contacts"               JSONB,
  ADD COLUMN "tech_stack_hints"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "email_provider"             TEXT,
  ADD COLUMN "website_cms"                TEXT,
  ADD COLUMN "recent_news"                JSONB,
  ADD COLUMN "public_certifications"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "charter_identifiers"        JSONB,
  ADD COLUMN "social_facebook_url"        TEXT,
  ADD COLUMN "social_twitter_url"         TEXT,
  ADD COLUMN "social_youtube_url"         TEXT,
  ADD COLUMN "press_contact_email"        TEXT,
  ADD COLUMN "enrichment_completed_at"    TIMESTAMP(3),
  ADD COLUMN "enrichment_source"          TEXT;
