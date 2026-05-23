import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingPhase, OnboardingTaskStatus, Role } from "@prisma/client";
import { PrintableForm } from "@/components/print/PrintableForm";

const PHASE_LABEL: Record<OnboardingPhase, string> = {
  PRE_ENGAGEMENT: "Pre-engagement",
  DISCOVERY:      "Discovery",
  ONBOARD:        "Onboard",
  STABILIZE:      "Stabilize",
  STEADY_STATE:   "Steady state",
};

const ROLE_LABEL: Record<Role, string> = {
  SALESPERSON:    "Salesperson",
  SALES_MANAGER:  "Sales Manager",
  VCIO:           "vCIO",
  COO:            "COO",
  SUPERADMIN:     "Superadmin",
};

export default async function MyTasksPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; includeDone?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const params = await searchParams;

  let lens: Role = session.user.role;
  if (params.role && (Object.values(Role) as string[]).includes(params.role) && session.user.role === Role.SUPERADMIN) {
    lens = params.role as Role;
  }
  const includeDone = params.includeDone === "true";

  const tasks = await prisma.onboardingTask.findMany({
    where: {
      ...(includeDone
        ? {}
        : { status: { notIn: [OnboardingTaskStatus.DONE, OnboardingTaskStatus.SKIPPED] } }),
      OR: [
        { ownerUserId: session.user.id },
        ...(lens === Role.SALESPERSON ? [] : [{ ownerRole: lens, ownerUserId: null }]),
      ],
    },
    orderBy: [{ dueAt: "asc" }, { phase: "asc" }, { position: "asc" }],
    include: {
      customer: { select: { id: true, lead: { select: { businessName: true } } } },
    },
  });

  const grouped = new Map<string, { name: string; tasks: typeof tasks }>();
  for (const t of tasks) {
    const cid = t.customer.id;
    if (!grouped.has(cid)) grouped.set(cid, { name: t.customer.lead.businessName, tasks: [] });
    grouped.get(cid)!.tasks.push(t);
  }

  return (
    <PrintableForm
      title={`My Tasks — ${ROLE_LABEL[lens]}`}
      subtitle={`${session.user.name} · ${format(new Date(), "PPP")} · ${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
    >
      <div className="space-y-5">
        {Array.from(grouped.values()).map((g) => (
          <section key={g.name} className="break-inside-avoid">
            <h2 className="text-sm font-semibold text-gtn-navy uppercase tracking-wide border-b border-gtn-lavender-2 pb-1 mb-2">
              {g.name}
            </h2>
            <ul className="space-y-1">
              {g.tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2 text-xs">
                  <span className="inline-block w-4 h-4 border border-gtn-grey-2 rounded-sm flex-shrink-0 mt-0.5" aria-hidden />
                  <div className="flex-1">
                    <p className={t.status === "DONE" || t.status === "SKIPPED" ? "line-through text-gtn-grey-2" : ""}>
                      <strong>{t.title}</strong>
                    </p>
                    <p className="text-[10px] text-gtn-grey-2">
                      {PHASE_LABEL[t.phase]}{t.dueAt ? ` · due ${format(new Date(t.dueAt), "PP")}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {grouped.size === 0 && <p className="text-sm text-gtn-grey-2">No tasks to print.</p>}
      </div>
    </PrintableForm>
  );
}
