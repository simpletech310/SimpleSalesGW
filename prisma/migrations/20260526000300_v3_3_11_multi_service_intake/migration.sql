-- v3.3.11 — Multi-service intake fields on Lead.
--
-- Reps capture not just IT but voice (VoIP), physical security
-- (access control + video), cabling, and AI advisory signals on first
-- touch so cross-sell opportunities aren't an afterthought.

ALTER TABLE "leads"
  ADD COLUMN "interested_services" "ServiceLine"[] NOT NULL DEFAULT ARRAY[]::"ServiceLine"[],
  ADD COLUMN "current_phone_system" TEXT,
  ADD COLUMN "current_phone_pain_point" TEXT,
  ADD COLUMN "current_access_control" TEXT,
  ADD COLUMN "current_access_door_count" INTEGER,
  ADD COLUMN "current_video_surveillance" TEXT,
  ADD COLUMN "current_video_camera_count" INTEGER,
  ADD COLUMN "cabling_status" TEXT,
  ADD COLUMN "expansion_plans" TEXT,
  ADD COLUMN "ai_advisory_interest" TEXT;
