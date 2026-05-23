import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type {
  AiReadinessScorecard,
  NistCsfScorecard,
  NistSp800171Scorecard,
  SiteSurveyScorecard,
} from "@/lib/discovery/scoring";

type Scorecard =
  | SiteSurveyScorecard
  | AiReadinessScorecard
  | NistCsfScorecard
  | NistSp800171Scorecard
  | null;

export function DiscoveryResult({
  title,
  customerName,
  customerId,
  assessmentId,
  scorecard,
}: {
  title: string;
  customerName: string;
  customerId: string;
  assessmentId: string;
  scorecard: Scorecard;
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <Link className="text-sm text-gtn-purple underline" href={`/accounts/${customerId}`}>← {customerName}</Link>
          <h1 className="text-2xl font-bold text-gtn-navy mt-2">{title} — result</h1>
        </div>
        <a
          href={`/accounts/${customerId}/discovery/${assessmentId}/print`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-gtn-purple underline self-end"
        >
          Print →
        </a>
      </div>

      {scorecard?.kind === "SITE_SURVEY" && <SiteSurveyView card={scorecard} />}
      {scorecard?.kind === "AI_READINESS" && <AiReadinessView card={scorecard} />}
      {scorecard?.kind === "NIST_CSF" && <NistCsfView card={scorecard} />}
      {scorecard?.kind === "NIST_800_171" && <NistSp800171View card={scorecard} />}
      {!scorecard && <Card><p className="text-sm text-gtn-grey-2">No scorecard data.</p></Card>}
    </div>
  );
}

function SiteSurveyView({ card }: { card: SiteSurveyScorecard }) {
  return (
    <>
      <Card>
        <h2 className="text-sm font-semibold mb-2">Summary</h2>
        <p className="text-sm">{card.summary}</p>
        {card.findings.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-gtn-grey-2 mb-1">Findings</p>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {card.findings.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        )}
      </Card>
      {card.risks.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold mb-2">Risks</h2>
          <ul className="space-y-2 text-sm">
            {card.risks.map((r, i) => (
              <li key={i}><SeverityPill s={r.severity} /> {r.description}</li>
            ))}
          </ul>
        </Card>
      )}
      {card.recommendedActions.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold mb-2">Recommended actions</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {card.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </Card>
      )}
    </>
  );
}

function AiReadinessView({ card }: { card: AiReadinessScorecard }) {
  return (
    <>
      <Card>
        <h2 className="text-sm font-semibold mb-2">Overall maturity</h2>
        <p className="text-3xl font-mono font-bold text-gtn-navy">{card.overall.toFixed(1)} <span className="text-base text-gtn-grey-2">/ 4</span></p>
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          {card.pillars.map((p) => (
            <div key={p.name} className="rounded border border-gtn-lavender-2 p-3">
              <p className="text-xs uppercase tracking-wide text-gtn-grey-2">{p.name}</p>
              <p className="text-lg font-mono font-semibold text-gtn-navy mt-1">{p.score.toFixed(1)}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="text-sm font-semibold mb-2">Use cases + roadmap</h2>
        {card.topUseCases.length > 0 && (
          <p className="text-xs text-gtn-grey-2 mb-3">
            Ready departments: {card.topUseCases.join(", ")}
          </p>
        )}
        {card.highestValueProcess && (
          <p className="text-sm mb-3"><strong>Highest-value process:</strong> {card.highestValueProcess}</p>
        )}
        {card.stalledInitiatives && (
          <p className="text-sm mb-3"><strong>Stalled initiative:</strong> {card.stalledInitiatives}</p>
        )}
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <PhaseList label="0–30 days" items={card.rollout.days_0_30} />
          <PhaseList label="31–90 days" items={card.rollout.days_31_90} />
          <PhaseList label="91–365 days" items={card.rollout.days_91_365} />
        </div>
      </Card>
    </>
  );
}

function NistCsfView({ card }: { card: NistCsfScorecard }) {
  return (
    <>
      <Card>
        <h2 className="text-sm font-semibold mb-2">Tier summary</h2>
        <p className="text-sm">
          Current overall Tier: <strong>{card.overallCurrentTier.toFixed(1)}</strong> · Target Tier: <strong>{card.targetTier}</strong>
        </p>
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {card.functions.map((f) => (
            <div key={f.name} className="rounded border border-gtn-lavender-2 p-3">
              <p className="text-xs uppercase tracking-wide text-gtn-grey-2">{f.name}</p>
              <p className="text-lg font-mono font-semibold text-gtn-navy mt-1">{f.currentTier.toFixed(1)}</p>
              {f.gap > 0 && <p className="text-[10px] text-gtn-amber">gap {f.gap.toFixed(1)}</p>}
            </div>
          ))}
        </div>
      </Card>
      {card.gaps.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold mb-2">Gaps</h2>
          <ul className="text-sm space-y-2">
            {card.gaps.map((g, i) => (
              <li key={i}><SeverityPill s={g.severity} /> {g.description}</li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <h2 className="text-sm font-semibold mb-2">Remediation roadmap</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <PhaseList label="0–30 days" items={card.remediationRoadmap.filter((r) => r.phase === "0-30").map((r) => r.item)} />
          <PhaseList label="31–90 days" items={card.remediationRoadmap.filter((r) => r.phase === "31-90").map((r) => r.item)} />
          <PhaseList label="91–365 days" items={card.remediationRoadmap.filter((r) => r.phase === "91-365").map((r) => r.item)} />
        </div>
      </Card>
    </>
  );
}

function PhaseList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded bg-gtn-lavender p-3">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-navy">{label}</p>
      <ul className="list-disc pl-4 text-xs space-y-1 mt-1">
        {items.length === 0 ? <li className="text-gtn-grey-2">—</li> : items.map((i, idx) => <li key={idx}>{i}</li>)}
      </ul>
    </div>
  );
}

function SeverityPill({ s }: { s: "high" | "medium" | "low" }) {
  const cls = s === "high" ? "bg-[#FBE9E7] text-gtn-red" : s === "medium" ? "bg-[#FEF3E2] text-gtn-amber" : "bg-gtn-lavender text-gtn-grey-2";
  return <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 mr-2 ${cls}`}>{s}</span>;
}

function NistSp800171View({ card }: { card: NistSp800171Scorecard }) {
  const sprsClass =
    card.sprsScore >= 100 ? "text-gtn-green"
      : card.sprsScore >= 80 ? "text-gtn-navy"
      : card.sprsScore >= 60 ? "text-gtn-amber"
      : "text-gtn-red";

  return (
    <>
      <Card>
        <h2 className="text-sm font-semibold mb-2">SPRS Score</h2>
        <p className={`text-4xl font-mono font-bold ${sprsClass}`}>
          {card.sprsScore} <span className="text-base text-gtn-grey-2">/ {card.sprsBaseline}</span>
        </p>
        {card.targetLevel && (
          <p className="text-xs text-gtn-grey-2 mt-1">
            Target: {card.targetLevel.replace("_", " ").toUpperCase()}
          </p>
        )}
        <p className="text-xs text-gtn-grey-2 mt-2">
          Scoring per NIST 800-171A: start at 110, subtract per-control deductions. SPRS reflects current posture; the POAM below describes the path to 110.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold mb-3">Family coverage</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {card.families.map((f) => (
            <div key={f.code} className="rounded border border-gtn-lavender-2 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono text-gtn-grey-2">{f.code}</p>
                <p className="text-xs font-mono">{f.implementationPct}%</p>
              </div>
              <p className="text-sm font-medium text-gtn-navy mt-1">{f.name.replace(f.code, "").trim()}</p>
              <p className="text-[11px] text-gtn-grey-2 mt-1">
                ✓ {f.implemented} · ◐ {f.partially} · ⌛ {f.planned} · ✗ {f.notImplemented}
                {f.notApplicable > 0 ? ` · n/a ${f.notApplicable}` : ""}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {card.poam.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold mb-3">POAM register ({card.poam.length} items)</h2>
          <ul className="text-xs space-y-2 max-h-96 overflow-y-auto">
            {card.poam.map((p) => (
              <li key={p.controlId} className="border-t border-gtn-lavender-2 pt-2 first:border-0 first:pt-0">
                <p>
                  <span className="font-mono text-gtn-purple mr-2">{p.controlId}</span>
                  <span className="font-medium">{p.statement}</span>
                </p>
                <p className="text-gtn-grey-2 mt-0.5">
                  Status: <span className="uppercase font-semibold">{p.status.replace("_", " ")}</span>
                  {" · "}deduction <span className="font-mono">-{p.deduction}</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold mb-3">SSP draft</h2>
        <p className="text-xs text-gtn-grey-2 mb-3">
          Auto-generated narrative per family from evidence + control status. Edit and export for submission to your assessor.
        </p>
        <div className="space-y-3">
          {card.ssp.map((s) => (
            <details key={s.familyCode} className="border border-gtn-lavender-2 rounded">
              <summary className="px-3 py-2 cursor-pointer text-sm font-medium text-gtn-navy">
                {s.familyName}
              </summary>
              <pre className="px-3 py-2 text-xs text-gtn-navy whitespace-pre-wrap font-mono bg-gtn-lavender/30">{s.narrative}</pre>
            </details>
          ))}
        </div>
      </Card>
    </>
  );
}
