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
}: {
  generateUrl: string;
  acceptUrl?: string;
  initialPlan: PlanSnapshot | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
  onboardingTasksUrl?: string;
  printDocUrl?: string;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanSnapshot | null>(initialPlan);
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      toast.success(`Plan accepted — ${data.tasksCreated} task${data.tasksCreated === 1 ? "" : "s"} added to onboarding.`);
      router.refresh();
    } finally {
      setAccepting(false);
    }
  }

  // hasAnyContent: did we get anything back at all? Used to flip the empty
  // state. Previously gated on recommendedTasks > 0 which made a partial
  // Claude response look like the button did nothing.
  const taskCount = plan?.recommendedTasks?.length ?? 0;
  const hasAnyContent = Boolean(
    plan && (
      taskCount > 0 ||
      (plan.summary && plan.summary.trim()) ||
      (plan.customerNextStep && plan.customerNextStep.trim()) ||
      (plan.risks && plan.risks.length > 0) ||
      (plan.recommendedServices && plan.recommendedServices.length > 0)
    ),
  );
  const hasTasks = taskCount > 0;
  const isAccepted = Boolean(acceptedAt);

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gtn-navy">vCIO plan</h3>
          <p className="text-xs text-gtn-grey-2">
            Claude reads the scorecard + MSP profile and turns it into a structured plan with tasks, services, and risks.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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

      {hasAnyContent && plan && !hasTasks && (
        <div className="rounded-md border border-gtn-amber/40 bg-amber-50 p-3 mb-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-gtn-amber mt-0.5 flex-shrink-0" />
          <div className="text-sm flex-1">
            <p className="font-semibold text-gtn-amber">Plan returned no tasks</p>
            <p className="text-xs text-gtn-grey-2 mt-0.5">
              Claude generated a summary but couldn&apos;t turn the assessment into specific tasks.
              The scorecard is probably too thin — answer more of the site-survey questions
              (especially Identity / Security / Backups / Compliance) and re-generate.
            </p>
          </div>
        </div>
      )}

      {hasAnyContent && plan && (
        <div className="space-y-4">
          {plan.summary && (
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-purple">Summary</p>
              <p className="text-sm text-gtn-navy mt-0.5 whitespace-pre-wrap">{plan.summary}</p>
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
          No plan yet. Click <strong>Generate plan</strong> to have Claude turn this assessment into recommended tasks + services.
        </p>
      )}
    </Card>
  );
}
