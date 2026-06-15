-- v3.6 — B2B Rocket CSV import: first-class lead-vendor signal columns.
--
-- The B2B Rocket / bebop.ai export ships a pre-scored, pre-researched
-- prospect per row (Score, Intent Topics, Description, Reason, Playbook
-- URL, up to 3 contacts). The CSV importer maps the prose research into the
-- existing research_summary / research_fit_signals / key_contacts columns;
-- these five columns hold the structured vendor signals that have no prior
-- home so reps can sort/filter by them and re-import idempotently.
--
-- Additive only — every column is nullable (or defaults to empty), so it
-- never blocks existing lead create/edit flows or clobbers manual data.

ALTER TABLE "leads"
  ADD COLUMN "external_lead_id"    TEXT,
  ADD COLUMN "vendor_lead_score"   INTEGER,
  ADD COLUMN "vendor_score_source" TEXT,
  ADD COLUMN "intent_topics"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "playbook_url"        TEXT;

-- Sort the lead list by vendor score; dedupe re-imports by vendor row id.
CREATE INDEX "leads_vendor_lead_score_idx" ON "leads" ("vendor_lead_score");
CREATE INDEX "leads_external_lead_id_idx" ON "leads" ("external_lead_id");
