import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { ListPage } from "@/components/templates";
import { Callout } from "@/components/brand";

/**
 * v3.3.14 — Catalog of every Gateway AI engagement in the platform.
 *
 * Surfaces, in one place, what each AI feature does, what it reads,
 * where it appears, and which catalog/profile signals ground it. Helps
 * onboarding and audit so no one has to dig through src/lib/ai/ to
 * figure out what the AI is doing.
 */

type Feature = {
  name: string;
  surface: string;
  whatItDoes: string;
  reads: ReadonlyArray<string>;
  grounding: ReadonlyArray<string>;
};

const FEATURES: ReadonlyArray<Feature> = [
  {
    name: "Lead research summary",
    surface: "Lead detail → Research tab → Gather research / Summarize with Gateway AI",
    whatItDoes:
      "Scrapes website + LinkedIn + Google Business, then synthesizes a pre-call brief plus three editable cards: Fit signals, Ask them, Risks. Cards persist on the Lead.",
    reads: [
      "Lead fields: industry, seat count, sites, compliance drivers, MSP context",
      "Multi-service intake: phone / access / video / cabling / expansion / AI signals",
      "Scraped website + LinkedIn + Google Business artifacts",
    ],
    grounding: [
      "MSP profile (mission, voice, services emphasis, win stories)",
      "Service catalog + sizing heuristics — recommendations come from what we sell only",
      "Full-stack rule: AI must consider voice / access / video / cabling / AI advisory, not default to cyber",
    ],
  },
  {
    name: "Sales coach",
    surface: "Lead detail → AI sales coach panel → Coach me on this deal",
    whatItDoes:
      "Reads the deal state + last 20 activities + qualification scorecard and returns the next best action, why now, a talk-track, risk flags, and a confidence rating.",
    reads: [
      "Lead context + qualification scorecard",
      "Last 20 Activity events on the deal",
      "Multi-service intake + research cards (so coach can suggest voice / access / video angles)",
    ],
    grounding: [
      "MSP profile + full-stack rule",
      "Service catalog: only proposes services we sell",
    ],
  },
  {
    name: "OSINT lead enrichment",
    surface: "New lead form → Look up online",
    whatItDoes:
      "Discovers the company's website if missing, scrapes homepage + /about + /contact + /team, regex-harvests phones / emails / LinkedIn / Google Maps URLs, then infers structured Lead fields (industry, seats, owner, contact, sites). Rep accepts per-field with confidence + source attribution.",
    reads: ["Business name + optional website + city the rep typed"],
    grounding: [
      "Industry enum: only proposes industries we tag in the system",
      "Strict 'never invent contact info that isn't on the page' rule",
    ],
  },
  {
    name: "vCIO plan generator",
    surface: "Lead or Customer → Discovery result → Generate plan",
    whatItDoes:
      "Turns a completed Discovery assessment into a structured plan: phase-tagged onboarding tasks, recommended services, risks, customer next step. On accept, materializes the tasks into OnboardingTask rows owned by the right vCIO / salesperson.",
    reads: [
      "DiscoveryAssessment answers + scorecard (now with per-section digest)",
      "Customer or Lead context (industry, seats, compliance)",
      "Multi-service intake (when present)",
    ],
    grounding: [
      "Service catalog: recommendedServices map to real ServiceLine values",
      "Sizing heuristics: 4-camera retail, 24-camera bank, 13-extension office, etc.",
      "Confidence + limitations + strengthen lists when assessment is thin",
    ],
  },
  {
    name: "Pre-sale narrative",
    surface: "Lead → Pre-sale technical assessment → Generate proposal narrative",
    whatItDoes:
      "Turns a completed pre-sale assessment + adopted line items into a one-paragraph customer-facing narrative with 'what's included' / 'not included' / 'next step' lists.",
    reads: [
      "DiscoveryAssessment findings, risks, recommendedLineItems",
      "Lead context (industry, contact)",
    ],
    grounding: [
      "MSP profile voice rules + win stories",
      "Service catalog: only references services + line items we sell",
    ],
  },
  {
    name: "Outreach personalizer",
    surface: "Lead → Outreach composer → Personalize with AI",
    whatItDoes:
      "Rewrites a template-style outreach email so it sounds specific to this lead, with the right tone (warm / formal / follow-up).",
    reads: [
      "Lead context (industry, location, MSP, compliance)",
      "Research notes + multi-service intake signals",
    ],
    grounding: [
      "MSP brand voice + differentiators",
      "Service catalog: only mentions services we sell",
      "Match angle to lead signals (retail → access/video, fast-growing → voice/AI)",
    ],
  },
  {
    name: "Objection coach",
    surface: "Lead → Objections tab → Generate rebuttals",
    whatItDoes:
      "For a logged objection, produces three rebuttal options of varying directness, each grounded in the deal context and the MSP profile's differentiators.",
    reads: ["The objection text + Lead context + recent activity"],
    grounding: [
      "MSP differentiators + win stories",
      "Service catalog: only proposes alternatives we sell",
    ],
  },
  {
    name: "Discovery prep brief",
    surface: "Lead → Discovery call view → Generate prep brief",
    whatItDoes:
      "Produces a focused brief for the upcoming discovery call: must-ask questions, hypotheses to validate, red flags to watch for.",
    reads: ["Lead context + research summary + recent activity"],
    grounding: ["MSP profile + service catalog"],
  },
  {
    name: "Handoff QC",
    surface: "Handoff form → Validate with AI",
    whatItDoes:
      "Reviews a Sales→Ops handoff payload (60+ fields) and returns severity-tagged warnings (missing data, contradictions, over-promises against the MSP profile's out-of-scope list).",
    reads: ["The structured handoff payload"],
    grounding: ["MSP profile out-of-scope list", "Service catalog"],
  },
  {
    name: "Handoff pain recap",
    surface: "Handoff form → Summarize stated pain",
    whatItDoes:
      "Reads the deal's activity log + objections + qualification notes and produces a 'stated pain' summary plus a 'quick win in week 1' suggestion for Ops.",
    reads: ["Activities + objections + qualification scorecard"],
    grounding: ["MSP profile"],
  },
  {
    name: "Trigger event detection",
    surface: "Lead → background scan",
    whatItDoes:
      "Detects compelling events (M&A, leadership change, breach, new compliance) in scraped news / public artifacts so reps can act on them.",
    reads: ["Recent ResearchArtifact entries on the Lead"],
    grounding: ["TriggerEvent enum (controlled vocabulary)"],
  },
  {
    name: "SOW draft",
    surface: "Lead → Proposal tab → Draft with AI",
    whatItDoes:
      "Picks an SOW template, fills the {{merge_fields}} from discovery + approved pricing + brand voice, and returns the full proposal draft. Manager / vCIO can review before sending.",
    reads: ["Selected SowTemplate + Lead + approved Pricing + MSP profile"],
    grounding: ["MSP voice + service catalog + approved sticker pricing only"],
  },
  {
    name: "Debrief AI draft",
    surface: "Lead → Close Won / Close Lost → Draft with AI",
    whatItDoes:
      "Auto-fills the post-deal debrief (primary reason, what worked / what broke, playbook update) from activities + objections + pricing history.",
    reads: ["Activities + objections + pricing approvals + signed docs"],
    grounding: ["MSP profile"],
  },
  {
    name: "Assessment verdict (vCIO go/no-go)",
    surface: "Lead → Pre-sale assessment result → vCIO verdict",
    whatItDoes:
      "vCIO records a structured GO / CAUTION / NO-GO verdict on a completed pre-sale assessment. AI can pre-fill the rationale.",
    reads: ["Scorecard + Lead context + MSP profile"],
    grounding: ["MSP out-of-scope list + service catalog"],
  },
  {
    name: "Kickoff narrative",
    surface: "Customer → Kickoff → Generate intro narrative",
    whatItDoes:
      "Writes the customer-facing kickoff narrative grounded in the handoff record and the original Lead's stated pain.",
    reads: ["Customer + Handoff + original Lead pain"],
    grounding: ["MSP voice + service catalog"],
  },
];

export default async function AiFeaturesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "audit:view")) {
    return (
      <div className="rounded-xl bg-surface border border-line-subtle p-6 max-w-md">
        <h2 className="text-lg font-semibold text-ink-strong">Not authorized</h2>
      </div>
    );
  }

  return (
    <ListPage
      title="Gateway AI features"
      subtitle={`${FEATURES.length} AI engagements across the platform. Every one is grounded in your MSP profile + live service catalog so recommendations stay on-brand and inside what you actually sell.`}
      crumbs={[{ href: "/admin", label: "Admin" }, { label: "AI features" }]}
    >
      <Callout kind="tip">
        Every Gateway AI call is metered (per-lead + org caps), audited, and grounded in two layers:
        the <strong>MSP business profile</strong> (mission, voice, services emphasis, win stories) and
        the <strong>live service catalog</strong> (every bundle + standalone line + line item + sizing
        heuristics). Recommendations cannot include services Gateway doesn&apos;t sell — that&apos;s
        enforced in the system prompt, not just suggested.
      </Callout>

      <div className="space-y-3 mt-4">
        {FEATURES.map((f) => (
          <article key={f.name} className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
            <header className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <h3 className="text-base font-semibold text-ink-strong">{f.name}</h3>
              <span className="text-[10px] uppercase tracking-wide font-semibold text-gtn-purple bg-brand-soft px-2 py-0.5 rounded">
                {f.surface}
              </span>
            </header>
            <p className="text-sm text-ink leading-relaxed">{f.whatItDoes}</p>
            <div className="grid md:grid-cols-2 gap-3 mt-3 text-xs">
              <div>
                <p className="ui-label mb-1">Reads</p>
                <ul className="space-y-0.5">
                  {f.reads.map((r, i) => (
                    <li key={i} className="text-ink-muted flex gap-1.5">
                      <span className="text-ink-faint">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="ui-label mb-1">Grounding</p>
                <ul className="space-y-0.5">
                  {f.grounding.map((g, i) => (
                    <li key={i} className="text-ink-muted flex gap-1.5">
                      <span className="text-ink-faint">•</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>
    </ListPage>
  );
}
