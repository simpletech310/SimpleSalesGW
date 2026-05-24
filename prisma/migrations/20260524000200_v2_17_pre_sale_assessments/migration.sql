-- v2.17 — pre-sale technical assessments
-- DiscoveryAssessment now works on either a Customer (post-handoff,
-- existing behavior) or a Lead (pre-sale scoping). On handoff acceptance
-- the lead-scoped rows get customerId populated; leadId stays for
-- traceability.

-- New DiscoveryKind values for the three lightweight pre-sale banks.
ALTER TYPE "DiscoveryKind" ADD VALUE 'VOICE_SCOPING';
ALTER TYPE "DiscoveryKind" ADD VALUE 'CCTV_SCOPING';
ALTER TYPE "DiscoveryKind" ADD VALUE 'ACCESS_CONTROL_SCOPING';

-- Make customer_id nullable + add lead_id companion.
ALTER TABLE "discovery_assessments"
  ALTER COLUMN "customer_id" DROP NOT NULL,
  ADD COLUMN "lead_id" UUID;

-- Index for lead-scoped lookups (notifications, lead detail panel).
CREATE INDEX "discovery_assessments_lead_id_kind_idx"
  ON "discovery_assessments"("lead_id", "kind");

-- FK + cascade — when a lead is deleted, its pre-sale assessments
-- go with it (same posture as customer cascade).
ALTER TABLE "discovery_assessments"
  ADD CONSTRAINT "discovery_assessments_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
