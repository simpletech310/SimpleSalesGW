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

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch(generateUrl, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) toast.error(data?.error ?? "AI budget exceeded for this lead.");
        else toast.error(data?.error ?? "Plan generation failed");
        return;
      }
      setPlan(data);
      toast.success("Plan ready");
      router.refresh();
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

  const hasPlan = Boolean(plan && plan.recommendedTasks && plan.recommendedTasks.length > 0);
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
              : <><Sparkles className="h-3.5 w-3.5 mr-1" /> {hasPlan ? "Re-generate plan" : "Generate plan"}</>}
          </Button>
          {hasPlan && acceptUrl && !isAccepted && (
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

      {hasPlan && plan && (
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

      {!hasPlan && !generating && (
        <p className="text-xs text-gtn-grey-2 italic">
          No plan yet. Click <strong>Generate plan</strong> to have Claude turn this assessment into recommended tasks + services.
        </p>
      )}
    </Card>
  );
}
