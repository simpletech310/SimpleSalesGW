-- v3.5 — ConnectWise (PSA + Sell) integration scaffolding.
--
-- CW is the system of record. This migration is additive only — no data
-- migration, every new column is nullable, so it never blocks existing
-- create/edit flows.
--
-- (1) LeadSource: two new external lead origins.
-- (2) CW external-id columns on leads / site_surveys / proposals / customers.
-- (3) Sync enums + the connectwise_sync ledger (idempotency + conflict) and
--     connectwise_events (raw inbound callback/poll trail) tables.

-- (1) LeadSource enum additions — additive only.
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'CONNECTWISE';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'B2B_ROCKET';

-- (2) CW external-id columns.
ALTER TABLE "leads"
  ADD COLUMN "connectwise_company_id"      TEXT,
  ADD COLUMN "connectwise_contact_id"      TEXT,
  ADD COLUMN "connectwise_sales_ticket_id" TEXT;

ALTER TABLE "site_surveys"
  ADD COLUMN "connectwise_ticket_id" TEXT;

ALTER TABLE "proposals"
  ADD COLUMN "connectwise_quote_id"     TEXT,
  ADD COLUMN "connectwise_quote_number" TEXT;

ALTER TABLE "customers"
  ADD COLUMN "connectwise_agreement_id" TEXT;

-- (3) Sync enums.
CREATE TYPE "ConnectWiseEntityType" AS ENUM (
  'COMPANY', 'CONTACT', 'OPPORTUNITY', 'SALES_TICKET',
  'SITE_SURVEY_TICKET', 'SELL_QUOTE', 'AGREEMENT'
);
CREATE TYPE "ConnectWiseSyncDirection" AS ENUM ('OUTBOUND', 'INBOUND');
CREATE TYPE "ConnectWiseSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'CONFLICT');

-- connectwise_sync ledger.
CREATE TABLE "connectwise_sync" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "entity_type"    "ConnectWiseEntityType" NOT NULL,
  "portal_id"      TEXT NOT NULL,
  "cw_id"          TEXT,
  "direction"      "ConnectWiseSyncDirection" NOT NULL,
  "status"         "ConnectWiseSyncStatus" NOT NULL DEFAULT 'PENDING',
  "payload_hash"   TEXT,
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "last_error"     TEXT,
  "last_synced_at" TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "connectwise_sync_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "connectwise_sync_entity_type_portal_id_key"
  ON "connectwise_sync" ("entity_type", "portal_id");
CREATE INDEX "connectwise_sync_status_idx" ON "connectwise_sync" ("status");
CREATE INDEX "connectwise_sync_cw_id_idx" ON "connectwise_sync" ("cw_id");

-- connectwise_events raw inbound trail.
CREATE TABLE "connectwise_events" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "source"       TEXT NOT NULL DEFAULT 'callback',
  "cw_entity"    TEXT NOT NULL,
  "cw_id"        TEXT,
  "action"       TEXT,
  "payload"      JSONB NOT NULL,
  "processed_at" TIMESTAMP(3),
  "error"        TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "connectwise_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "connectwise_events_processed_at_idx" ON "connectwise_events" ("processed_at");
CREATE INDEX "connectwise_events_cw_entity_cw_id_idx" ON "connectwise_events" ("cw_entity", "cw_id");
