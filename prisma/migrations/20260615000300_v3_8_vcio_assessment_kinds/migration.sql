-- v3.8 — vCIO assessment menu for the site survey.
--
-- Five new DiscoveryKind values the vCIO can run while performing an accepted
-- site survey. The lead-scoped DiscoveryAssessment engine already handles
-- create/run/score/persist for any kind; these just add menu options that map
-- to new question banks + scorers in the app layer.
--
-- Additive only — new enum values, no column or data changes.

ALTER TYPE "DiscoveryKind" ADD VALUE IF NOT EXISTS 'QUICK_IT';
ALTER TYPE "DiscoveryKind" ADD VALUE IF NOT EXISTS 'NETWORK';
ALTER TYPE "DiscoveryKind" ADD VALUE IF NOT EXISTS 'WIFI';
ALTER TYPE "DiscoveryKind" ADD VALUE IF NOT EXISTS 'SOC2_INTERVIEW';
ALTER TYPE "DiscoveryKind" ADD VALUE IF NOT EXISTS 'AI_READINESS_LIGHT';
