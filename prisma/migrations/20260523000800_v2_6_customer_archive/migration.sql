-- v2.6 — Customer archive metadata: archivedAt + archivedReason on customers.
ALTER TABLE "customers"
    ADD COLUMN "archived_at"     TIMESTAMP(3),
    ADD COLUMN "archived_reason" TEXT;
