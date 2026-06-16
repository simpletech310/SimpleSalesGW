-- v3.7 — Site-survey reschedule request.
--
-- The vCIO reviewing a queued site survey gets a third outcome alongside
-- Accept and Reject: "Request reschedule" — bounce the survey back to the
-- rep asking for a new date/time without flagging it as a quality problem.
-- The rep edits the date/time and resubmits (PATCH flips it back to
-- AWAITING_VCIO_ACCEPT).
--
-- Additive only — new enum value + two nullable columns.

-- New status value. Placed after REJECTED to mirror the Prisma enum order.
ALTER TYPE "SiteSurveyStatus" ADD VALUE IF NOT EXISTS 'RESCHEDULE_REQUESTED' AFTER 'REJECTED';

ALTER TABLE "site_surveys"
  ADD COLUMN "reschedule_requested_at" TIMESTAMP(3),
  ADD COLUMN "reschedule_note"         TEXT;
