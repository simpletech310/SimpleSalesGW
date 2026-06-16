"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Plus, Sparkles, ClipboardList } from "lucide-react";
import { DiscoveryKind, DiscoveryStatus } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/**
 * v3.8 — vCIO assessment launcher, shown in the Site Survey tab once the
 * survey is accepted. The vCIO picks an assessment, runs the whole
 * questionnaire (reusing the generic discovery runner), and gets insights +
 * next steps on completion. Multiple assessments per lead, all saved.
 */

const KIND_TITLE: Record<DiscoveryKind, string> = {
  QUICK_IT: "Quick IT Assessment",
  SITE_SURVEY: "Full IT Assessment",
  NIST_CSF: "Cybersecurity (Light)",
  NIST_800_171: "Cybersecurity (Full)",
  SOC2_INTERVIEW: "SOC 2 Readiness Interview",
  NETWORK: "Network Assessment",
  WIFI: "Wi-Fi Assessment",
  AI_READINESS_LIGHT: "AI Readiness (Light)",
  AI_READINESS: "AI Readiness (Full)",
  VOICE_SCOPING: "Voice / Phone Scoping",
  CCTV_SCOPING: "CCTV / Video Scoping",
  ACCESS_CONTROL_SCOPING: "Access Control Scoping",
};

const MENU: ReadonlyArray<{ group: string; items: ReadonlyArray<{ kind: DiscoveryKind; tagline: string }> }> = [
  {
    group: "IT",
    items: [
      { kind: "QUICK_IT", tagline: "~10 min triage — sizing + biggest risks." },
      { kind: "SITE_SURVEY", tagline: "Full IT discovery — sites, network, identity, security." },
    ],
  },
  {
    group: "Cybersecurity",
    items: [
      { kind: "NIST_CSF", tagline: "NIST CSF 2.0 self-assessment (light)." },
      { kind: "NIST_800_171", tagline: "NIST 800-171 / CMMC readiness (full)." },
      { kind: "SOC2_INTERVIEW", tagline: "SOC 2 control interview → readiness %." },
    ],
  },
  {
    group: "Network & Wi-Fi",
    items: [
      { kind: "NETWORK", tagline: "Circuits, firewall, switching, segmentation." },
      { kind: "WIFI", tagline: "Coverage, capacity, security, dead spots." },
    ],
  },
  {
    group: "AI",
    items: [
      { kind: "AI_READINESS_LIGHT", tagline: "Fast AI maturity read → readiness %." },
      { kind: "AI_READINESS", tagline: "Full AI readiness questionnaire." },
    ],
  },
];

type Risk = { severity: "high" | "medium" | "low"; description: string };
type AssessmentRow = {
  id: string;
  kind: DiscoveryKind;
  status: DiscoveryStatus;
  startedAt: string | null;
  completedAt: string | null;
  scorecard: {
    summary?: string;
    findings?: string[];
    risks?: Risk[];
    recommendedActions?: string[];
    coveragePct?: number;
    readinessPct?: number;
    band?: string;
  } | null;
  createdBy: { name: string };
};

export function SurveyAssessmentsPanel({ leadId, canRun }: { leadId: string; canRun: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<AssessmentRow[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState<DiscoveryKind | null>(null);
  const [narratingId, setNarratingId] = useState<string | null>(null);
  const [nextSteps, setNextSteps] = useState<Record<string, { narrative: string; nextStep: string }>>({});

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/discovery`);
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.assessments ?? []);
  }, [leadId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function start(kind: DiscoveryKind) {
    setCreating(kind);
    try {
      const res = await fetch(`/api/leads/${leadId}/discovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't start the assessment");
        return;
      }
      router.push(`/leads/${leadId}/discovery/${data.assessment.id}`);
    } finally {
      setCreating(null);
    }
  }

  async function generateNextSteps(assessmentId: string) {
    setNarratingId(assessmentId);
    try {
      const res = await fetch(`/api/leads/${leadId}/discovery/${assessmentId}/narrative`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Could not generate insights");
        return;
      }
      setNextSteps((cur) => ({
        ...cur,
        [assessmentId]: { narrative: data.narrative ?? "", nextStep: data.nextStep ?? "" },
      }));
      router.refresh();
    } finally {
      setNarratingId(null);
    }
  }

  if (items === null) {
    return <Card><p className="text-sm text-gtn-grey-2">Loading assessments…</p></Card>;
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-gtn-navy flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-gtn-purple" /> Assessments
          </h3>
          <p className="text-xs text-gtn-grey-2 mt-0.5">
            Run any assessment while on-site. Each one saves its own insights + next steps; run as many as you need.
          </p>
        </div>
        {canRun && !picking && (
          <Button size="sm" onClick={() => setPicking(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New assessment
          </Button>
        )}
      </div>

      {picking && canRun && (
        <div className="border border-gtn-lavender-2 rounded-md p-3 mb-4 space-y-3">
          {MENU.map((g) => (
            <div key={g.group}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gtn-grey-2 mb-1.5">{g.group}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {g.items.map((it) => (
                  <button
                    type="button"
                    key={it.kind}
                    disabled={creating != null}
                    onClick={() => start(it.kind)}
                    className="text-left rounded border border-gtn-lavender-2 p-2.5 hover:border-gtn-purple/40 hover:bg-gtn-lavender/30 disabled:opacity-60"
                  >
                    <p className="text-sm font-semibold text-gtn-navy flex items-center gap-2">
                      {creating === it.kind && <Loader2 className="h-3 w-3 animate-spin" />}
                      {KIND_TITLE[it.kind]}
                    </p>
                    <p className="text-xs text-gtn-grey-2 mt-0.5">{it.tagline}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setPicking(false)} className="text-xs text-gtn-grey-2 hover:text-gtn-navy">
            cancel
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-gtn-grey-2">
          {canRun ? "No assessments run yet. Click " : "No assessments run yet. The vCIO will run these on-site."}
          {canRun && <strong>New assessment</strong>}
          {canRun && " to begin."}
        </p>
      ) : (
        <ul className="divide-y divide-gtn-lavender-2">
          {items.map((a) => {
            const isCompleted = a.status === DiscoveryStatus.COMPLETED;
            const sc = a.scorecard;
            const ns = nextSteps[a.id];
            return (
              <li key={a.id} className="py-3 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium text-gtn-navy flex items-center gap-2">
                      <StatusBadge status={a.status} />
                      {KIND_TITLE[a.kind] ?? a.kind}
                    </p>
                    <p className="text-xs text-gtn-grey-3 mt-1">
                      {a.completedAt
                        ? `Completed ${format(new Date(a.completedAt), "MMM d")}`
                        : a.startedAt
                        ? `Started ${format(new Date(a.startedAt), "MMM d")}`
                        : "Not started"} · by {a.createdBy.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isCompleted && canRun && (
                      <Button size="sm" variant="secondary" onClick={() => generateNextSteps(a.id)} disabled={narratingId === a.id}>
                        {narratingId === a.id
                          ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Writing…</>
                          : <><Sparkles className="h-3.5 w-3.5 mr-1" /> {ns ? "Regenerate" : "Insights & next steps"}</>}
                      </Button>
                    )}
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/leads/${leadId}/discovery/${a.id}`}>
                        {isCompleted ? "View result" : canRun ? "Continue" : "Open"}
                      </Link>
                    </Button>
                  </div>
                </div>

                {isCompleted && sc && (
                  <div className="rounded-md border border-gtn-lavender-2 bg-white p-3 text-xs space-y-2">
                    {sc.summary && <p className="text-sm text-gtn-navy">{sc.summary}</p>}
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {typeof sc.readinessPct === "number" && (
                        <span className="rounded-full bg-gtn-lavender text-gtn-navy px-2 py-0.5 font-semibold">
                          Readiness {sc.readinessPct}%{sc.band ? ` · ${sc.band}` : ""}
                        </span>
                      )}
                      {typeof sc.coveragePct === "number" && (
                        <span className="rounded-full bg-gtn-lavender text-gtn-navy px-2 py-0.5 font-semibold">
                          Coverage {sc.coveragePct}%
                        </span>
                      )}
                      {sc.risks && sc.risks.length > 0 && (
                        <span className="rounded-full bg-gtn-lavender text-gtn-navy px-2 py-0.5 font-semibold">
                          {sc.risks.length} risk{sc.risks.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    {sc.risks && sc.risks.length > 0 && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-gtn-grey-2 mb-1">Insights</p>
                        <ul className="space-y-1">
                          {sc.risks.slice(0, 5).map((r, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span
                                className={
                                  r.severity === "high"
                                    ? "mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0"
                                    : r.severity === "medium"
                                    ? "mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-gtn-amber flex-shrink-0"
                                    : "mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-gtn-grey-3 flex-shrink-0"
                                }
                                aria-hidden
                              />
                              <span className="text-gtn-navy">{r.description}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {sc.recommendedActions && sc.recommendedActions.length > 0 && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-gtn-purple mb-1">Next steps</p>
                        <ul className="list-disc list-inside text-gtn-navy space-y-0.5">
                          {sc.recommendedActions.slice(0, 6).map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {ns && (ns.narrative || ns.nextStep) && (
                  <div className="rounded-md border border-gtn-lavender-2 bg-gtn-lavender/30 p-3 space-y-2">
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-gtn-purple flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" /> Recommended narrative
                    </p>
                    {ns.narrative && <p className="text-sm text-gtn-navy whitespace-pre-wrap">{ns.narrative}</p>}
                    {ns.nextStep && (
                      <p className="text-xs text-gtn-grey-2 border-t border-gtn-lavender-2 pt-2">
                        <strong>Next step:</strong> {ns.nextStep}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: DiscoveryStatus }) {
  const cls =
    status === DiscoveryStatus.COMPLETED ? "bg-gtn-green-bg text-gtn-green"
      : status === DiscoveryStatus.IN_PROGRESS ? "bg-[#FEF3E2] text-gtn-amber"
      : "bg-gtn-lavender text-gtn-grey-2";
  const label = status === DiscoveryStatus.NOT_STARTED ? "Not started" : status.replace(/_/g, " ");
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${cls}`}>
      {label}
    </span>
  );
}
