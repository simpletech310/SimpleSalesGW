-- v3.3.13 — Attachment.category + caption so SE/vCIO can scan lead
-- attachments at a glance without opening every file.

ALTER TABLE "attachments"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "caption" TEXT;
