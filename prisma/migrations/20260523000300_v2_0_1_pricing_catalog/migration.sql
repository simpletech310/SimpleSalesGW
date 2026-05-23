-- v2.0.1 — extend PricingApproval with catalog-aware fields.

ALTER TABLE "pricing_approvals"
    ADD COLUMN "sticker_one_time" DECIMAL(12, 2),
    ADD COLUMN "proposed_one_time" DECIMAL(12, 2),
    ADD COLUMN "bundle_id" TEXT,
    ADD COLUMN "seat_count" INTEGER,
    ADD COLUMN "below_floor" BOOLEAN NOT NULL DEFAULT FALSE;
