import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canSeeCustomer } from "@/lib/rbac";
import { PrintableForm } from "@/components/print/PrintableForm";
import { OnboardingPhase, OnboardingTaskStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PHASES: OnboardingPhase[] = [
  OnboardingPhase.PRE_ENGAGEMENT,
  OnboardingPhase.DISCOVERY,
  OnboardingPhase.ONBOARD,
  OnboardingPhase.STABILIZE,
  OnboardingPhase.STEADY_STATE,
];
const PHASE_LABEL: Record<OnboardingPhase, string> = {
  PRE_ENGAGEMENT: "Phase 0 · Pre-Engagement",
  DISCOVERY: "Phase 1 · Discovery",
  ONBOARD: "Phase 2 · Onboard",
  STABILIZE: "Phase 3 · Stabilize",
  STEADY_STATE: "Phase 4 · Steady State",
};

export default async function OnboardingPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      lead: { select: { businessName: true, ownerUserId: true } },
      onboardingTasks: {
        orderBy: [{ phase: "asc" }, { position: "asc" }],
        include: { owner: { select: { name: true } } },
      },
    },
  });
  if (!customer) notFound();
  if (!canSeeCustomer(session.user.role, session.user.id, customer.lead.ownerUserId)) {
    return <p className="text-sm text-gtn-grey-2">Not authorized.</p>;
  }

  return (
    <PrintableForm title="Onboarding Checklist" subtitle={customer.lead.businessName}>
      <div className="space-y-6">
        {PHASES.map((phase) => {
          const tasks = customer.onboardingTasks.filter((t) => t.phase === phase);
          const done = tasks.filter((t) => t.status === OnboardingTaskStatus.DONE || t.status === OnboardingTaskStatus.SKIPPED).length;
          return (
            <section key={phase} className="break-inside-avoid">
              <h2 className="text-base font-semibold text-gtn-navy border-b border-gtn-lavender-2 pb-1 mb-2">
                {PHASE_LABEL[phase]} <span className="text-xs text-gtn-grey-2 ml-2">({done}/{tasks.length})</span>
              </h2>
              <ul className="space-y-1 text-sm">
                {tasks.length === 0 ? (
                  <li className="text-gtn-grey-2 text-xs">No tasks in this phase.</li>
                ) : tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3">
                    <span className="font-mono text-xs">
                      {t.status === OnboardingTaskStatus.DONE ? "☑" :
                        t.status === OnboardingTaskStatus.SKIPPED ? "⊟" :
                        t.status === OnboardingTaskStatus.BLOCKED ? "✗" :
                        "☐"}
                    </span>
                    <div className="flex-1">
                      <p className={t.status === "DONE" || t.status === "SKIPPED" ? "text-gtn-grey-3 line-through" : "text-gtn-navy"}>{t.title}</p>
                      {t.description && <p className="text-xs text-gtn-grey-2">{t.description}</p>}
                      <p className="text-[10px] text-gtn-grey-3">
                        {t.owner ? `Owner: ${t.owner.name}` : "Unassigned"}
                        {t.dueAt ? ` · Due ${format(new Date(t.dueAt), "PP")}` : ""}
                        {t.completedAt ? ` · ✓ ${format(new Date(t.completedAt), "PP")}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </PrintableForm>
  );
}
