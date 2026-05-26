-- v3.3.10 — Persist the three Research-tab cards (Fit Signals / Ask
-- Them / Risks) alongside the existing research_summary on each Lead,
-- so they survive a page reload and can be edited inline.

ALTER TABLE "leads"
  ADD COLUMN "research_fit_signals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "research_suggested_questions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "research_risks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
