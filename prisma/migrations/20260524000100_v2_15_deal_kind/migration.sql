-- v2.15 — service-line first-class deals (voice, cabling, access, video, custom)

-- Add DealKind enum
CREATE TYPE "DealKind" AS ENUM (
  'MANAGED_IT_BUNDLE',
  'VOICE_ONLY',
  'VOICE_PLUS_VIDEO',
  'STRUCTURED_CABLING_JOB',
  'ACCESS_CONTROL_PROJECT',
  'VIDEO_SURVEILLANCE_PROJECT',
  'CUSTOM_MIX'
);

-- Add deal_kind + deal_line_items to leads
ALTER TABLE "leads"
  ADD COLUMN "deal_kind" "DealKind" NOT NULL DEFAULT 'MANAGED_IT_BUNDLE',
  ADD COLUMN "deal_line_items" JSONB;

-- Index for quick filtering by deal kind on /leads team views
CREATE INDEX "leads_deal_kind_idx" ON "leads"("deal_kind");
