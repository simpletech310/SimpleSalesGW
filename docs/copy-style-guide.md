# Gateway portal copy style guide

The portal is used by a salesperson on her phone between calls, a vCIO running a
QBR live, and a COO triaging the inbox at 7 AM. Copy should sound like a senior
teammate explaining something over coffee — short sentences, plain words.

## The three rules

1. **No jargon without a tooltip.** Any acronym or insider term (NIST CSF, RMM,
   MFA, SPRS, POAM, vCIO, BAA, MSA, SOW, "below-floor pricing", "non-strategic
   deal") must be wrapped in `<GlossaryTerm>` the first time it appears on a
   page. The glossary lives at `src/lib/glossary.ts`.

2. **Verbs over nouns.** Buttons and section labels should describe the action,
   not the abstraction.
   - Bad: "Stage advancement" · Good: "Move to next step"
   - Bad: "Approval routing" · Good: "Who has to sign off"
   - Bad: "Pipeline visibility" · Good: "Who can see this lead"

3. **Tell the user what happens next.** Buttons should preview the outcome.
   - Bad: "Submit" · Good: "Submit for COO approval"
   - Bad: "Save" · Good: "Save and notify Ops"
   - Empty states should say what to do, not just what's missing.

## Patterns

### Empty states

Use `<EmptyState>` from `@/components/help/EmptyState`. Required fields:
- **Icon** — one Lucide icon that matches the page's domain.
- **Title** — present tense, 3–5 words. "No leads yet". "Nothing to approve".
- **Body** — 1–2 sentences explaining what to do. Avoid "you don't have any X".
- **CTA** — primary action button linking to where they go next.

### Help text under form fields

Use `<FieldHelp>` from `@/components/help/FieldHelp` next to a `<Label>`. The
help-copy text lives in `src/lib/help-copy.ts` (the `HELP` registry) — put new
copy there, not inline, so jargon audits stay sane.

### Tooltips on inline jargon

Use `<GlossaryTerm term="NIST CSF" />`. If the entry isn't in
`src/lib/glossary.ts`, add it.

### Callouts

- `<Callout kind="tip">` — non-blocking guidance ("Hover this field for the
  formula"). Don't gate behavior, don't repeat what the field label says.
- `<Callout kind="important">` — consequence the user should understand before
  acting ("This will email the client a self-service link").
- `<Callout kind="note">` — context that's helpful but not actionable.
- `<Callout kind="warning">` — destructive or expensive action ahead.

### Section headings

Use `gtn-section-label` (small-caps tracked) for navigation-adjacent or
within-card section dividers. Use plain `<h1>`/`<h2>` with `text-gtn-navy
font-bold` for page-level titles.

## Banned phrases

| Don't say… | Say… |
| --- | --- |
| "advance stage" | "move to next step" |
| "non-strategic deal" (alone) | "non-strategic deal — flagged because the deal-quality score is below 40" |
| "below-floor pricing" (alone) | "below-floor pricing — the per-seat MRR is lower than what the bundle allows" |
| "submit" | "submit for [role] approval" or "send" |
| "user" | "you" / "the customer" / "Lin" (use specifics) |
| "leverage" | "use" |
| "synergize" | (just don't) |
| "stakeholder" | the actual role (CEO, CFO, decision-maker) |
| "actionable insight" | the specific thing they should do |

## Voice

- **First person plural** for Gateway as a team: "we deploy" / "we manage" / "we hand off".
- **Second person** when addressing the salesperson: "you'll see the score update".
- **Third person** for the customer: "the customer signs the SOW" not "they sign".

## Length budgets

| Surface | Words |
| --- | --- |
| Page title | 1–4 |
| Section label | 1–3 |
| Button label | 1–4 |
| FieldHelp tooltip | 6–40 |
| Empty-state body | 15–40 |
| Callout body | 10–60 |
| Glossary definition | 8–40 |

## When in doubt

Read the line out loud. If you'd never say it that way to a coworker, rewrite it.
