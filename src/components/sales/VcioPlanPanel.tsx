"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Sparkles, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { OnboardingPhase } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/**
 * v2.23 — vCIO plan panel.
 *
 * Composable card that lives on both the Lead presale-assessment page
 * and the Customer DiscoveryResult page. Reads the assessment's existing
 * `aiPlanSnapshot` / `planAcceptedAt` (passed in from server) and lets
 * the user generate / re-generate / accept.
 *
 * The "accept" path only exists for customer-side (we don't seed
 * onboarding tasks on a lead without a Customer record). Pass
 * `acceptUrl` to enable it.
 */

type PlanSnapshot = {
  summary?: string;
  recommendedTasks?: Array<{
    phase: OnboardingPhase | string;
    title: string;
    description?: string;
    ownerRole?: string;
    dueOffsetDays?: number;
    priority?: "high" | "medium" | "low";
    sourceFinding?: string;
  }>;
  recommendedServices?: Array<{ serviceLine: string; why: string }>;
  risks?: Array<{ severity: "high" | "medium" | "low"; description: string }>;
  customerNextStep?: string;
  /** v3.3.6 fields */
  confidence?: "high" | "medium" | "low";
  limitations?: string[];
  strengthen?: string[];
  parseError?: boolean;
  coveragePct?: number | null;
  generatedAt?: string;
  generatedByUserId?: string;
};

const PHASE_ORDER: OnboardingPhase[] = [
  OnboardingPhase.PRE_ENGAGEMENT,
  OnboardingPhase.DISCOVERY,
  OnboardingPhase.ONBOARD,
  OnboardingPhase.STABILIZE,
  OnboardingPhase.STEADY_STATE,
];

export function VcioPlanPanel({
  generateUrl,
  acceptUrl,
  initialPlan,
  acceptedAt,
  acceptedByName,
  onboardingTasksUrl,
  printDocUrl,
  reopenApiUrl,
}: {
  generateUrl: string;
  acceptUrl?: string;
  initialPlan: PlanSnapshot | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
  onboardingTasksUrl?: string;
  printDocUrl?: string;
  /**
   * v3.3.6 — PATCH endpoint that reopens the assessment for editing.
   * When set, an "Edit assessment" button posts { action: "reopen" } to it
   * then refreshes so the page flips back to the runner.
   */
  reopenApiUrl?: string;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanSnapshot | null>(initialPlan);
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reopen() {
    if (!reopenApiUrl) return;
    if (!confirm("Reopen this assessment to edit answers? You'll need to mark it complete again afterwards.")) return;
    setReopening(true);
    try {
      const res = await fetch(reopenApiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reopen" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Reopen failed");
        return;
      }
      toast.success("Assessment reopened — fill in answers, then mark complete again.");
      router.refresh();
    } finally {
      setReopening(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(generateUrl, { method: "POST" });
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      const errMsg =
        (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : null) ?? `HTTP ${res.status}`;
      if (!res.ok) {
        const friendly =
          res.status === 429 ? `AI budget exceeded for this lead. ${errMsg}`
          : res.status === 400 ? `Configuration issue: ${errMsg}`
          : res.status === 403 ? "You don't have permission to run this plan."
          : res.status === 409 ? "The assessment must be marked complete before generating a plan."
          : `Plan generation failed — ${errMsg}`;
        setError(friendly);
        toast.error(friendly);
        return;
      }
      setPlan(data as PlanSnapshot);
      const taskCount = (data as PlanSnapshot)?.recommendedTasks?.length ?? 0;
      if (taskCount === 0) {
        toast.message("Plan ready, but no tasks were extracted — review summary/risks below.");
      } else {
        toast.success(`Plan ready — ${taskCount} task${taskCount === 1 ? "" : "s"}`);
      }
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function accept(replaceExisting = false) {
    if (!acceptUrl) return;
    setAccepting(true);
    try {
      const res = await fetch(acceptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replaceExisting }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && !replaceExisting) {
          if (confirm(`${data.error}\n\nReplace existing vCIO-plan tasks?`)) {
            await accept(true);
          }
          return;
        }
        toast.error(data?.error ?? "Acceptance failed");
        return;
      }
      const total = data.tasksCreated as number;
      const mine = (data.tasksOnAccepter as number | undefined) ?? 0;
      const tail = mine > 0
        ? ` · ${mine} now on your /my-tasks`
        : "";
      toast.success(`Plan accepted — ${total} task${total === 1 ? "" : "s"} added to onboarding${tail}.`);
      router.refresh();
    } finally {
      setAccepting(false);
    }
  }

  // hasAnyContent: did we get anything back at all? Used to flip the empty
  // state. Previously gated on recommendedTasks > 0 which made a partial
  // Claude response look like the button did nothing.
  const taskCount = plan?.recommendedTasks?.length ?? 0;
  // v3.3.6 — If summary literally starts with `{` or `[` it's almost
  // certainly leftover raw JSON from a parse-failed older snapshot. Don't
  // render that as prose.
  const looksLikeRawJson = (() => {
    const s = plan?.summary?.trim() ?? "";
    return s.startsWith("{") || s.startsWith("[") || s.startsWith("```");
  })();
  const safeSummary = looksLikeRawJson ? "" : plan?.summary ?? "";
  const planHadParseError = Boolean(plan?.parseError) || looksLikeRawJson;
  const hasAnyContent = Boolean(
    plan && !planHadParseError && (
      taskCount > 0 ||
      (safeSummary && safeSummary.trim()) ||
      (plan.customerNextStep && plan.customerNextStep.trim()) ||
      (plan.risks && plan.risks.length > 0) ||
      (plan.recommendedServices && plan.recommendedServices.length > 0)
    ),
  );
  const hasTasks = taskCount > 0;
  const isAccepted = Boolean(acceptedAt);
  // v3.3.6 — "limited info" banner triggers on low coverage OR explicit
  // low/medium AI confidence OR limitations[] from the snapshot.
  const coveragePct = typeof plan?.coveragePct === "number" ? plan.coveragePct : null;
  const showLimitedBanner = Boolean(
    plan && !planHadParseError && (
      (coveragePct != null && coveragePct < 60) ||
      plan.confidence === "low" ||
      (plan.limitations && plan.limitations.length > 0) ||
      (plan.strengthen && plan.strengthen.length > 0)
    ),
  );

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gtn-navy">vCIO plan</h3>
          <p className="text-xs text-gtn-grey-2">
            Gateway AI reads the scorecard + MSP profile and turns it into a structured plan with tasks, services, and risks.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {reopenApiUrl && (
            <Button size="sm" variant="secondary" onClick={reopen} disabled={reopening || generating}>
              {reopening ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
              Edit assessment
            </Button>
          )}
          {printDocUrl && (
            <Button asChild size="sm" variant="ghost">
              <Link href={printDocUrl} target="_blank">
                <FileText className="h-3.5 w-3.5 mr-1" /> Print site survey
              </Link>
            </Button>
          )}
          <Button size="sm" onClick={generate} disabled={generating}>
            {generating ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Generating…</>
              : <><Sparkles className="h-3.5 w-3.5 mr-1" /> {hasAnyContent ? "Re-generate plan" : "Generate plan"}</>}
          </Button>
          {hasTasks && acceptUrl && !isAccepted && (
            <Button size="sm" onClick={() => accept(false)} disabled={accepting}>
              {accepting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
              Accept plan
            </Button>
          )}
        </div>
      </div>

      {isAccepted && (
        <div className="rounded-md border border-gtn-green/40 bg-gtn-green-bg p-3 mb-3 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-gtn-green mt-0.5 flex-shrink-0" />
          <div className="text-sm flex-1">
            <p className="font-semibold text-gtn-green">Plan accepted</p>
            <p className="text-xs text-gtn-grey-2">
              {acceptedByName ?? "—"} · {acceptedAt ? format(new Date(acceptedAt), "PPp") : ""}
            </p>
            {onboardingTasksUrl && (
              <Link href={onboardingTasksUrl} className="text-xs text-gtn-purple underline mt-1 inline-block">
                View materialized tasks →
              </Link>
            )}
          </div>
        </div>
      )}

      {error && !generating && (
        <div className="rounded-md border border-gtn-red/40 bg-gtn-red/5 p-3 mb-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-gtn-red mt-0.5 flex-shrink-0" />
          <div className="text-sm flex-1">
            <p className="font-semibold text-gtn-red">Plan generation failed</p>
            <p className="text-xs text-gtn-grey-2 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {planHadParseError && !generating && (
        <div className="rounded-md border border-gtn-red/40 bg-gtn-red/5 p-3 mb-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-gtn-red mt-0.5 flex-shrink-0" />
          <div className="text-sm flex-1">
            <p className="font-semibold text-gtn-red">Plan came back in an unreadable format</p>
            <p className="text-xs text-gtn-grey-2 mt-0.5">
              Gateway AI responded with text we couldn&apos;t parse as a plan. Click <strong>Re-generate plan</strong> to try again — the prompt was tightened so this should be rare.
              {reopenApiUrl && (
                <> Or open the assessment and fill in more answers, then re-generate.</>
              )}
            </p>
          </div>
        </div>
      )}

      {hasAnyContent && plan && !hasTasks && (
        <div className="rounded-md border border-gtn-amber/40 bg-amber-50 p-3 mb-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-gtn-amber mt-0.5 flex-shrink-0" />
          <div className="text-sm flex-1">
            <p className="font-semibold text-gtn-amber">Plan returned no tasks</p>
            <p className="text-xs text-gtn-grey-2 mt-0.5">
              Gateway AI generated a summary but couldn&apos;t turn the assessment into specific tasks.
              The scorecard is probably too thin — answer more of the site-survey questions
              (especially Identity / Security / Backups / Compliance) and re-generate.
            </p>
          </div>
        </div>
      )}

      {showLimitedBanner && plan && (
        <div className="rounded-md border border-gtn-amber/40 bg-amber-50 p-3 mb-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-gtn-amber mt-0.5 flex-shrink-0" />
            <div className="text-sm flex-1">
              <p className="font-semibold text-gtn-amber">
                Plan based on limited information
                {coveragePct != null && <span className="font-normal text-gtn-grey-2"> · assessment {coveragePct}% complete</span>}
                {plan.confidence && <span className="font-normal text-gtn-grey-2"> · confidence {plan.confidence}</span>}
              </p>
              <p className="text-xs text-gtn-grey-2 mt-0.5">
                The recommendations below are an initial read. Filling in more of the assessment will produce a stronger plan.
              </p>
            </div>
          </div>
          {plan.limitations && plan.limitations.length > 0 && (
            <div className="text-xs text-gtn-grey-2 pl-6">
              <p className="font-semibold text-gtn-navy mb-1">What this plan couldn&apos;t cover</p>
              <ul className="list-disc list-inside space-y-0.5">
                {plan.limitations.slice(0, 6).map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </div>
          )}
          {plan.strengthen && plan.strengthen.length > 0 && (
            <div className="text-xs text-gtn-grey-2 pl-6">
              <p className="font-semibold text-gtn-navy mb-1">To make the next plan stronger, answer:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {plan.strengthen.slice(0, 8).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
              {reopenApiUrl && (
                <div className="mt-2">
                  <Button size="xs" variant="secondary" onClick={reopen} disabled={reopening || generating}>
                    {reopening ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                    Open assessment to fill these in →
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {hasAnyContent && plan && (
        <div className="space-y-4">
          {safeSummary && (
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-purple">Summary</p>
              <p className="text-sm text-gtn-navy mt-0.5 whitespace-pre-wrap">{safeSummary}</p>
            </div>
          )}

          {plan.customerNextStep && (
            <div className="bg-gtn-lavender/30 rounded p-2">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-purple">Customer next step</p>
              <p className="text-sm italic text-gtn-navy mt-0.5">&ldquo;{plan.customerNextStep}&rdquo;</p>
            </div>
          )}

          {/* Recommended tasks, grouped by phase */}
          {hasTasks && (
          <div>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-purple mb-2">
              Recommended tasks ({plan.recommendedTasks?.length ?? 0})
            </p>
            <div className="space-y-2">
              {PHASE_ORDER.map((phase) => {
                const items = (plan.recommendedTasks ?? []).filter((t) => t.phase === phase);
                if (items.length === 0) return null;
                return (
                  <div key={phase} className="border border-gtn-lavender-2 rounded p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gtn-grey-2">
                      {String(phase).replace(/_/g, " ")} · {items.length}
                    </p>
                    <ul className="mt-1 space-y-1.5">
                      {items.map((t, i) => (
                        <li key={i} className="text-sm">
                          <div className="flex items-start gap-2">
                            <span className={`text-[10px] uppercase font-bold tracking-wide rounded px-1 py-0.5 mt-0.5 ${t.priority === "high" ? "bg-gtn-red/20 text-gtn-red" : t.priority === "low" ? "bg-gtn-lavender text-gtn-grey-2" : "bg-gtn-amber/20 text-gtn-amber"}`}>
                              {t.priority ?? "med"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <strong className="text-gtn-navy">{t.title}</strong>
                              {t.ownerRole && <span className="text-xs text-gtn-grey-2"> · {String(t.ownerRole)}</span>}
                              {typeof t.dueOffsetDays === "number" && <span className="text-xs text-gtn-grey-2"> · day {t.dueOffsetDays}</span>}
                              {t.description && <p className="text-xs text-gtn-grey-2 mt-0.5">{t.description}</p>}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Risks */}
          {plan.risks && plan.risks.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-red flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Risks
              </p>
              <ul className="space-y-1 mt-1">
                {plan.risks.map((r, i) => (
                  <li key={i} className="text-sm">
                    <span className={`text-[10px] uppercase font-bold tracking-wide rounded px-1 py-0.5 mr-1 ${r.severity === "high" ? "bg-gtn-red/20 text-gtn-red" : r.severity === "low" ? "bg-gtn-lavender text-gtn-grey-2" : "bg-gtn-amber/20 text-gtn-amber"}`}>
                      {r.severity}
                    </span>
                    {r.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended services */}
          {plan.recommendedServices && plan.recommendedServices.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-purple">Recommended services</p>
              <ul className="space-y-1 mt-1">
                {plan.recommendedServices.map((s, i) => (
                  <li key={i} className="text-sm">
                    <strong>{s.serviceLine.replace(/_/g, " ")}</strong> — <span className="text-gtn-grey-2">{s.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!hasAnyContent && !generating && !error && (
        <p className="text-xs text-gtn-grey-2 italic">
          No plan yet. Click <strong>Generate plan</strong> to have Gateway AI turn this assessment into recommended tasks + services.
        </p>
      )}
    </Card>
  );
}
